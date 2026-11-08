import {Prisma} from "@prisma/client";
import {prisma} from "./db";
import {blockradarConfig} from "./blockradar";
import {submitBlockradarPayout} from "./blockradar-payout";
import {readBlockradarUsdcBalance} from "./blockradar-master-balance";
import {WITHDRAWAL_FEE_USDC_MICROS} from "./withdrawal-fee";
import {masterCustodyCoversTreasury} from "./withdrawal-worker-rules";
import {reviewAlertCutoff} from "./withdrawal-review-timeout";
import {journeyLog} from "./journey-log";

export async function processPendingWithdrawal(targetWithdrawalId?:string){
 const {key,walletId}=blockradarConfig();
 const assetId=process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID;
 if(!assetId)throw new Error("Missing Blockradar asset ID");
 const master=await prisma.treasury.findUnique({where:{kind:"DEPOSIT"}});
 if(!master||master.walletId!==walletId||master.source!=="MASTER_WALLET"||master.asset!=="USDC")throw new Error("Missing master deposit treasury");
 // An unknown provider outcome is NOT a failed payout. A stale REVIEW keeps
 // reserving gross investor funds indefinitely, even if Blockradar timed out.
 // Alert operators after the threshold, but continue serving other PENDING
 // requests. No automatic reversal, refund, or second provider submission.
 if(!targetWithdrawalId){
  const stale=await prisma.withdrawal.findFirst({
   where:{status:"REVIEW",updatedAt:{lte:reviewAlertCutoff(new Date())}},
   orderBy:{updatedAt:"asc"},select:{id:true},
  });
  if(stale)journeyLog("warn","withdrawal_payout","review_requires_reconciliation",{withdrawalId:stale.id});
 }
 const candidate=await prisma.withdrawal.findFirst({where:{status:"PENDING",treasuryTransactionId:null,...(targetWithdrawalId?{id:targetWithdrawalId}:{})},orderBy:[{updatedAt:"asc"},{createdAt:"asc"}]});
 if(!candidate)return "empty";
 const claim=await prisma.$transaction(async tx=>{
  const current=await tx.withdrawal.findUnique({where:{id:candidate.id}});
  if(!current||current.status!=="PENDING"||current.treasuryTransactionId)return false;
  if(current.grossUsdcMicros!==current.amountUsdcMicros+current.feeUsdcMicros||current.feeUsdcMicros<WITHDRAWAL_FEE_USDC_MICROS){
   await tx.withdrawal.update({where:{id:current.id},data:{status:"FAILED",failureCode:"INVALID_WITHDRAWAL_TOTALS"}});
   return "failed_validation";
  }
  const balance=await tx.user.findUniqueOrThrow({where:{id:current.userId}});
  const pending=await tx.withdrawal.aggregate({where:{userId:current.userId,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]},id:{not:current.id}},_sum:{grossUsdcMicros:true}});
  const allocations=await tx.positionAllocation.aggregate({where:{userId:current.userId,kind:"ALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","REVIEW"]}},_sum:{amountUsdcMicros:true}});
  if(balance.unallocated-current.grossUsdcMicros-(pending._sum.grossUsdcMicros??0n)-(allocations._sum.amountUsdcMicros??0n)<0n){
   await tx.withdrawal.update({where:{id:current.id},data:{status:"FAILED",failureCode:"INSUFFICIENT_AVAILABLE_FUNDS"}});
   return "failed_validation";
  }
  const locked=await tx.withdrawal.updateMany({where:{id:current.id,status:"PENDING",treasuryTransactionId:null},data:{status:"SUBMITTING"}});
  if(locked.count!==1)return false;
  return true;
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 if(claim==="failed_validation")return "failed_validation";
 if(!claim)return "already_claimed";
 // Preflight uses the already-approved withdrawal fee. No additional quote here.
 // All master-held investor principal is in DEPOSIT; no separate returned bucket.
 let providerSubmissionStarted=false;
 try{
  const deposit=await prisma.treasury.findUnique({where:{kind:"DEPOSIT"}});
  if(!deposit||deposit.amount<0n||deposit.walletId!==walletId||deposit.source!=="MASTER_WALLET")
   throw new Error("Invalid DEPOSIT treasury custody accounting");
  const onChain=await readBlockradarUsdcBalance({key,walletId,assetId});
  if(!masterCustodyCoversTreasury(onChain,deposit.amount))throw new Error("Insufficient master wallet custody for treasury liabilities");
  providerSubmissionStarted=true;
  const receipt=await submitBlockradarPayout({id:candidate.id,userId:candidate.userId,address:candidate.destinationAddress,amount:candidate.amountUsdcMicros},{key,walletId,assetId});
  await prisma.$transaction(async tx=>{
   await tx.withdrawal.updateMany({where:{id:candidate.id,status:"SUBMITTING"},data:{status:"PROCESSING",providerTransactionId:receipt.id,transactionHash:receipt.hash}});
  });
  return "submitted";
 }catch(error){
  if(!providerSubmissionStarted){
   // No transfer request was issued, so this attempt can safely be retried.
   await prisma.$transaction(async tx=>{
    const current=await tx.withdrawal.findUnique({where:{id:candidate.id}});
    if(!current||current.status!=="SUBMITTING")return;
    await tx.withdrawal.update({where:{id:current.id},data:{
      status:"PENDING",
      failureCode:null
    }});
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
   return "preflight_retry";
  }
  await prisma.withdrawal.updateMany({where:{id:candidate.id,status:"SUBMITTING"},data:{
    status:"REVIEW",failureCode:"PAYOUT_RESPONSE_UNKNOWN"
  }});
  // REVIEW retains its gross reservation until authenticated provider outcome;
  // the worker never resubmits a potentially paid transfer.
  return "review_pending";
 }
}
