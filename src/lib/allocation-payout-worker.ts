import {randomUUID} from "node:crypto";
import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";
import {blockradarConfig} from "./blockradar.ts";
import {submitBlockradarAllocation} from "./blockradar-allocation.ts";
import {readBlockradarUsdcBalance} from "./blockradar-master-balance.ts";
import {masterCustodyCoversTreasury} from "./withdrawal-worker-rules.ts";
import {reviewExpiryCutoff} from "./withdrawal-review-timeout.ts";

// One transfer per strategy per run; all eligible pending allocation rows share
// its immutable reference and destination. Signed callbacks settle every row.
export async function processPendingAllocations(){
 const config=blockradarConfig();
 const assetId=process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID;
 if(!assetId)throw new Error("Missing Blockradar USDC asset ID");
 const master=await prisma.treasury.findUnique({where:{kind:"DEPOSIT"}});
 if(!master||master.walletId!==config.walletId||master.source!=="MASTER_WALLET")throw new Error("Invalid master custody treasury");
 const expired=await prisma.treasuryTransfer.findFirst({where:{direction:"ALLOCATE",status:"REVIEW",createdAt:{lte:reviewExpiryCutoff(new Date())}},orderBy:{createdAt:"asc"}});
 if(expired){
  const changed=await prisma.$transaction(async tx=>{
   const moved=await tx.treasuryTransfer.updateMany({where:{id:expired.id,direction:"ALLOCATE",status:"REVIEW",createdAt:{lte:reviewExpiryCutoff(new Date())}},data:{status:"FAILED"}});
   if(moved.count!==1)return false;
   await tx.positionAllocation.updateMany({where:{treasuryId:expired.id,status:{in:["SUBMITTING","PROCESSING","REVIEW"]}},data:{status:"FAILED"}});
   return true;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  return changed?"review_expired":"already_settled";
 }
 const first=await prisma.positionAllocation.findFirst({
  where:{status:"PENDING",treasuryId:null,position:{strategy:{kalshiWalletAddress:{not:null}}}},
  orderBy:[{createdAt:"asc"},{id:"asc"}],include:{position:{include:{strategy:true}}},
 });
 if(!first)return "empty";
 const strategy=first.position.strategy;
 const address=strategy.kalshiWalletAddress;
 if(!address||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))return "invalid_strategy_address";
 const reference="allocation:"+randomUUID();
 const batch=await prisma.$transaction(async tx=>{
  const rows=await tx.positionAllocation.findMany({
   where:{status:"PENDING",treasuryId:null,position:{strategyId:strategy.id}},
   orderBy:[{createdAt:"asc"},{id:"asc"}],take:100,
  });
  if(!rows.length)return null;
  const locked=await tx.positionAllocation.updateMany({where:{id:{in:rows.map(r=>r.id)},status:"PENDING",treasuryId:null},data:{status:"SUBMITTING",providerReference:reference}});
  if(locked.count!==rows.length)throw new Error("Concurrent allocation claim");
  const amount=rows.reduce((n,r)=>n+r.amountUsdcMicros,0n);
  if(amount<=0n)throw new Error("Invalid allocation batch");
  const transfer=await tx.treasuryTransfer.create({data:{
   direction:"ALLOCATE",status:"PENDING",assetId,asset:"USDC",amountUsdcMicros:amount,
   feeUsdcMicros:0n,destinationWalletAddress:address,masterWalletAddress:master.walletAddress,
   masterWalletId:config.walletId,network:"solana",reference,
  }});
  await tx.positionAllocation.updateMany({where:{id:{in:rows.map(r=>r.id)},status:"SUBMITTING",providerReference:reference},data:{treasuryId:transfer.id}});
  return {amount,transferId:transfer.id};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 if(!batch)return "already_claimed";
 let submissionStarted=false;
 try{
  const [deposit,deallocate]=await Promise.all([
   prisma.treasury.findUnique({where:{kind:"DEPOSIT"}}),
   prisma.treasury.findUnique({where:{kind:"DEALLOCATE"}}),
  ]);
  if(!deposit||deposit.amount<0n||(deallocate&&deallocate.amount<0n))throw new Error("Invalid master balance");
  const onChain=await readBlockradarUsdcBalance({key:config.key,walletId:config.walletId,assetId});
  if(!masterCustodyCoversTreasury(onChain,deposit.amount,deallocate?.amount??0n))throw new Error("Insufficient master custody");
  submissionStarted=true;
  const receipt=await submitBlockradarAllocation({reference,strategyId:strategy.id,address,amount:batch.amount},{...config,assetId});
  await prisma.$transaction(async tx=>{
   const changed=await tx.treasuryTransfer.updateMany({where:{id:batch.transferId,status:"PENDING"},data:{status:"PROCESSING",originExternalId:receipt.id,destinationExternalId:receipt.hash}});
   if(changed.count===1)await tx.positionAllocation.updateMany({where:{treasuryId:batch.transferId,status:"SUBMITTING"},data:{status:"PROCESSING"}});
  });
  return "submitted";
 }catch(error){
  if(!submissionStarted){
   await prisma.$transaction(async tx=>{
    const changed=await tx.treasuryTransfer.deleteMany({where:{id:batch.transferId,status:"PENDING",originExternalId:null}});
    if(changed.count)await tx.positionAllocation.updateMany({where:{treasuryId:batch.transferId,status:"SUBMITTING"},data:{status:"PENDING",treasuryId:null,providerReference:null}});
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
   return "preflight_retry";
  }
  await prisma.$transaction(async tx=>{
   await tx.treasuryTransfer.updateMany({where:{id:batch.transferId,status:"PENDING"},data:{status:"REVIEW"}});
   await tx.positionAllocation.updateMany({where:{treasuryId:batch.transferId,status:"SUBMITTING"},data:{status:"REVIEW"}});
  });
  return "review_pending";
 }
}
