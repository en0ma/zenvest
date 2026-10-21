import {Prisma} from "@prisma/client";
import {prisma} from "./db";
import {blockradarConfig} from "./blockradar";
import {submitBlockradarPayout,withdrawalReference} from "./blockradar-payout";
import {estimateWithdrawalNetworkFee} from "./blockradar-withdrawal-fee";
import {WITHDRAWAL_FEE_USDC_MICROS} from "./withdrawal-fee";
import {withdrawalFeeBreakdown} from "./withdrawal-network-fee";

export async function processPendingWithdrawal(){
 const {key,walletId}=blockradarConfig();
 const assetId=process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID;
 if(!assetId)throw new Error("Missing Blockradar asset ID");
 const master=await prisma.treasury.findUnique({where:{kind:"DEPOSIT"}});
 if(!master||master.walletId!==walletId||master.source!=="MASTER_WALLET"||master.asset!=="USDC")throw new Error("Missing master deposit treasury");
 // One claim per invocation; only PENDING records are eligible. SUBMITTING
 // and REVIEW are NEVER automatically retried after unknown network outcome.
 const candidate=await prisma.investorWithdrawal.findFirst({where:{status:"PENDING",treasuryId:null},orderBy:{createdAt:"asc"}});
 if(!candidate)return "empty";
 const claim=await prisma.$transaction(async tx=>{
  const current=await tx.investorWithdrawal.findUnique({where:{id:candidate.id}});
  if(!current||current.status!=="PENDING"||current.treasuryId)return false;
  if(current.grossUsdcMicros!==current.amountUsdcMicros+current.feeUsdcMicros||current.feeUsdcMicros<WITHDRAWAL_FEE_USDC_MICROS)throw new Error("Withdrawal totals mismatch");
  const balance=await tx.user.findUniqueOrThrow({where:{id:current.userId}});
  const pending=await tx.investorWithdrawal.aggregate({where:{userId:current.userId,status:{in:["PENDING","PROCESSING","REVIEW","SUBMITTING"]},id:{not:current.id}},_sum:{grossUsdcMicros:true}});
  const allocations=await tx.positionAllocation.aggregate({where:{userId:current.userId,status:{in:["PENDING","ALLOCATING","REVIEW"]}},_sum:{amountUsdcMicros:true}});
  if(balance.unallocated-current.grossUsdcMicros-(pending._sum.grossUsdcMicros??0n)-(allocations._sum.amountUsdcMicros??0n)<0n)throw new Error("User funds are not available");
  const locked=await tx.investorWithdrawal.updateMany({where:{id:current.id,status:"PENDING",treasuryId:null},data:{status:"SUBMITTING"}});
  if(locked.count!==1)return false;
  const transfer=await tx.treasuryTransfer.create({data:{
   direction:"WITHDRAWAL",status:"REVIEW",assetId,asset:"USDC",amountUsdcMicros:current.amountUsdcMicros,
   feeUsdcMicros:current.feeUsdcMicros,destinationWalletAddress:current.destinationAddress,
   network:"solana",masterWalletAddress:master.walletAddress,masterWalletId:walletId,
   reference:withdrawalReference(current.id)
  }});
  await tx.investorWithdrawal.update({where:{id:current.id},data:{treasuryId:transfer.id}});
  return true;
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 if(!claim)return "already_claimed";
 // Fail closed until the real provider wallet liquidity and native SOL gas checks
 // have independently succeeded. A claimed transfer is left in REVIEW to avoid
 // duplicate submission after ambiguous errors.
 try{
  const available=await prisma.treasury.findUnique({where:{kind:"DEPOSIT"}});
  const reserved=await prisma.investorWithdrawal.aggregate({where:{status:{in:["PROCESSING","REVIEW","SUBMITTING"]}},_sum:{amountUsdcMicros:true}});
  if(!available||available.amount<(reserved._sum.amountUsdcMicros??0n))throw new Error("Insufficient master ledger liquidity");
  const fee=await estimateWithdrawalNetworkFee(candidate.destinationAddress,candidate.amountUsdcMicros,true);
  const split=withdrawalFeeBreakdown(candidate.grossUsdcMicros,fee);
  if(split.total>candidate.feeUsdcMicros)throw new Error("Network fee grew beyond investor-approved fee");
  const receipt=await submitBlockradarPayout({id:candidate.id,address:candidate.destinationAddress,amount:candidate.amountUsdcMicros},{key,walletId,assetId});
  await prisma.$transaction(async tx=>{
   await tx.treasuryTransfer.updateMany({where:{reference:withdrawalReference(candidate.id),status:"REVIEW"},data:{status:"PROCESSING",originExternalId:receipt.id,destinationExternalId:receipt.hash}});
   await tx.investorWithdrawal.updateMany({where:{id:candidate.id,status:"SUBMITTING"},data:{status:"PROCESSING",providerTransactionId:receipt.id,transactionHash:receipt.hash}});
  });
  return "submitted";
 }catch(error){
  await prisma.investorWithdrawal.updateMany({where:{id:candidate.id,status:"SUBMITTING"},data:{status:"REVIEW",failureCode:"PAYOUT_RECONCILIATION_REQUIRED"}});
  // Never retry automatically. A response timeout can hide a successful payout.
  throw error;
 }
}
