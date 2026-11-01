import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";
import {blockradarConfig} from "./blockradar.ts";
import {submitBlockradarAllocation} from "./blockradar-allocation.ts";
import {readBlockradarUsdcBalance} from "./blockradar-master-balance.ts";
import {masterCustodyCoversTreasury} from "./withdrawal-worker-rules.ts";

// Each strategy event is durable BEFORE posting to Blockradar. Never create a
// treasury transaction in the worker: source custody is not yet confirmed.
export async function processPendingAllocations(){
 const config=blockradarConfig();
 const assetId=process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID;
 if(!assetId)throw new Error("Missing Blockradar USDC asset ID");
 const master=await prisma.treasury.findUnique({where:{kind:"DEPOSIT"}});
 if(!master||master.walletId!==config.walletId||master.source!=="MASTER_WALLET")throw new Error("Invalid master custody treasury");
 const first=await prisma.positionAllocation.findFirst({
  where:{kind:"ALLOCATE",status:"PENDING",strategyEventId:null,position:{strategy:{kalshiWalletAddress:{not:null}}}},
  orderBy:[{createdAt:"asc"},{id:"asc"}],include:{position:{include:{strategy:true}}},
 });
 if(!first)return "empty";
 const strategy=first.position.strategy;
 const address=strategy.kalshiWalletAddress;
 if(!address||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))return "invalid_strategy_address";
 const batch=await prisma.$transaction(async tx=>{
  const rows=await tx.positionAllocation.findMany({
   where:{strategyId:strategy.id,kind:"ALLOCATE",status:"PENDING",strategyEventId:null},
   orderBy:[{createdAt:"asc"},{id:"asc"}],
  });
  if(!rows.length)return null;
  const amount=rows.reduce((n,r)=>n+r.amountUsdcMicros,0n);
  if(amount<=0n)throw new Error("Invalid allocation batch");
  const event=await tx.strategyEvent.create({data:{
   strategyId:strategy.id,kind:"ALLOCATE",amountUsdcMicros:amount,status:"PROCESSING",
  }});
  const claimed=await tx.positionAllocation.updateMany({
   where:{id:{in:rows.map(r=>r.id)},kind:"ALLOCATE",status:"PENDING",strategyEventId:null},
   data:{status:"SUBMITTING",strategyEventId:event.id},
  });
  if(claimed.count!==rows.length)throw new Error("Concurrent allocation claim");
  return {amount,eventId:event.id};
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
  await submitBlockradarAllocation({
   reference:"strategy_withdrawal:"+batch.eventId,strategyId:strategy.id,address,amount:batch.amount,
  },{...config,assetId});
  await prisma.positionAllocation.updateMany({
   where:{strategyEventId:batch.eventId,kind:"ALLOCATE",status:"SUBMITTING"},
   data:{status:"PROCESSING"},
  });
  return "submitted";
 }catch(error){
  // Failure BEFORE the network call is safe to release for subsequent claiming.
  if(!submissionStarted){
   await prisma.$transaction(async tx=>{
    const e=await tx.strategyEvent.findUnique({where:{id:batch.eventId}});
    if(!e||e.sourceConfirmed||e.treasuryTransactionId)return;
    const changed=await tx.positionAllocation.updateMany({
     where:{strategyEventId:batch.eventId,kind:"ALLOCATE",status:"SUBMITTING"},
     data:{status:"PENDING",strategyEventId:null},
    });
    if(changed.count>0)await tx.strategyEvent.delete({where:{id:batch.eventId}});
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
   return "preflight_retry";
  }
  // A network timeout could hide a successful transfer. Never re-submit.
  await prisma.positionAllocation.updateMany({
   where:{strategyEventId:batch.eventId,kind:"ALLOCATE",status:{in:["SUBMITTING","PROCESSING"]}},
   data:{status:"REVIEW"},
  });
  return "review_pending";
 }
}
