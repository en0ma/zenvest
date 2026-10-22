import {Prisma} from "@prisma/client";
import {prisma} from "./db";
import {blockradarConfig} from "./blockradar";
import {submitBlockradarPayout,withdrawalReference} from "./blockradar-payout";
import {readBlockradarUsdcBalance} from "./blockradar-master-balance";
import {WITHDRAWAL_FEE_USDC_MICROS} from "./withdrawal-fee";
import {masterCustodyCoversTreasury} from "./withdrawal-worker-rules";
import {scheduleWithdrawalRetry,MAX_WITHDRAWAL_ATTEMPTS} from "./withdrawal-retry";

export async function processPendingWithdrawal(){
 const {key,walletId}=blockradarConfig();
 const assetId=process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID;
 if(!assetId)throw new Error("Missing Blockradar asset ID");
 const master=await prisma.treasury.findUnique({where:{kind:"DEPOSIT"}});
 if(!master||master.walletId!==walletId||master.source!=="MASTER_WALLET"||master.asset!=="USDC")throw new Error("Missing master deposit treasury");
 // Revisit due REVIEW records first without resending a transfer.
 const due=await prisma.investorWithdrawal.findFirst({where:{status:"REVIEW",nextRetry:{lte:new Date()},attempts:{lt:MAX_WITHDRAWAL_ATTEMPTS}},orderBy:{nextRetry:"asc"}});
 if(due){
  const schedule=scheduleWithdrawalRetry(due.attempts,new Date());
  const changed=await prisma.investorWithdrawal.updateMany({where:{id:due.id,status:"REVIEW",attempts:due.attempts,nextRetry:{lte:new Date()}},data:{attempts:schedule.attempts,nextRetry:schedule.nextRetry}});
  // No blind resubmission: the provider might have paid on the first call.
  return changed.count===1?(schedule.nextRetry?"reconciliation_scheduled":"reconciliation_exhausted"):"already_claimed";
 }
 const candidate=await prisma.investorWithdrawal.findFirst({where:{status:"PENDING",treasuryId:null},orderBy:[{updatedAt:"asc"},{createdAt:"asc"}]});
 if(!candidate)return "empty";
 const claim=await prisma.$transaction(async tx=>{
  const current=await tx.investorWithdrawal.findUnique({where:{id:candidate.id}});
  if(!current||current.status!=="PENDING"||current.treasuryId)return false;
  if(current.grossUsdcMicros!==current.amountUsdcMicros+current.feeUsdcMicros||current.feeUsdcMicros<WITHDRAWAL_FEE_USDC_MICROS)throw new Error("Withdrawal totals mismatch");
  const balance=await tx.user.findUniqueOrThrow({where:{id:current.userId}});
  const pending=await tx.investorWithdrawal.aggregate({where:{userId:current.userId,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]},id:{not:current.id}},_sum:{grossUsdcMicros:true}});
  const allocations=await tx.positionAllocation.aggregate({where:{userId:current.userId,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},_sum:{amountUsdcMicros:true}});
  if(balance.unallocated-current.grossUsdcMicros-(pending._sum.grossUsdcMicros??0n)-(allocations._sum.amountUsdcMicros??0n)<0n)throw new Error("User funds are not available");
  const locked=await tx.investorWithdrawal.updateMany({where:{id:current.id,status:"PENDING",treasuryId:null},data:{status:"SUBMITTING"}});
  if(locked.count!==1)return false;
  const transfer=await tx.treasuryTransfer.create({data:{
   direction:"WITHDRAWAL",status:"PENDING",assetId,asset:"USDC",amountUsdcMicros:current.amountUsdcMicros,
   feeUsdcMicros:current.feeUsdcMicros,destinationWalletAddress:current.destinationAddress,
   network:"solana",masterWalletAddress:master.walletAddress,masterWalletId:walletId,
   reference:withdrawalReference(current.id)
  }});
  await tx.investorWithdrawal.update({where:{id:current.id},data:{treasuryId:transfer.id}});
  return true;
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 if(!claim)return "already_claimed";
 // Preflight uses the already-approved withdrawal fee. No additional quote here.
 // The master must hold at least the funds accounted for in DEPOSIT +
 // DEALLOCATE treasury buckets before any payout submission.
 let providerSubmissionStarted=false;
 try{
  const [deposit,deallocate]=await Promise.all([
    prisma.treasury.findUnique({where:{kind:"DEPOSIT"}}),
    prisma.treasury.findUnique({where:{kind:"DEALLOCATE"}}),
  ]);
  if(!deposit||deposit.amount<0n||(deallocate&&deallocate.amount<0n))
    throw new Error("Invalid treasury custody accounting");
  const onChain=await readBlockradarUsdcBalance({key,walletId,assetId});
  if(!masterCustodyCoversTreasury(onChain,deposit.amount,deallocate?.amount??0n))throw new Error("Insufficient master wallet custody for treasury liabilities");
  providerSubmissionStarted=true;
  const receipt=await submitBlockradarPayout({id:candidate.id,userId:candidate.userId,address:candidate.destinationAddress,amount:candidate.amountUsdcMicros},{key,walletId,assetId});
  await prisma.$transaction(async tx=>{
   await tx.treasuryTransfer.updateMany({where:{reference:withdrawalReference(candidate.id),status:"PENDING"},data:{status:"PROCESSING",originExternalId:receipt.id,destinationExternalId:receipt.hash}});
   await tx.investorWithdrawal.updateMany({where:{id:candidate.id,status:"SUBMITTING"},data:{status:"PROCESSING",providerTransactionId:receipt.id,transactionHash:receipt.hash}});
  });
  return "submitted";
 }catch(error){
  if(!providerSubmissionStarted){
   // No transfer request was issued, so this attempt can safely be retried.
   await prisma.$transaction(async tx=>{
    const current=await tx.investorWithdrawal.findUnique({where:{id:candidate.id}});
    if(!current||current.status!=="SUBMITTING")return;
    await tx.investorWithdrawal.update({where:{id:current.id},data:{
      status:"PENDING",treasuryId:null,
      failureCode:null
    }});
    await tx.treasuryTransfer.deleteMany({where:{reference:withdrawalReference(candidate.id),status:"PENDING",originExternalId:null}});
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
   return "preflight_retry";
  }
  const retry=scheduleWithdrawalRetry(0,new Date());
  await prisma.investorWithdrawal.updateMany({where:{id:candidate.id,status:"SUBMITTING"},data:{
    status:"REVIEW",failureCode:"PAYOUT_RESPONSE_UNKNOWN",attempts:retry.attempts,nextRetry:retry.nextRetry
  }});
  // A timeout can hide an accepted payout. REVIEW retains the balance hold and
  // allows scheduled reconciliation; it never resubmits a potentially paid transfer.
  return "review_scheduled";
 }
}
