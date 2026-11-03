import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";
/** After independently verified Kalshi withdrawal + HMAC-verified Blockradar
 * sweep only. Does not touch investor positions or balances.
 */
export async function settleVerifiedStaffKalshiReturn(input:{
 withdrawalId:string;providerWithdrawalId:string;masterReceiptId:string;
 kalshiWalletAddress:string;masterWalletAddress:string;amountUsdcMicros:bigint;
 asset:"USDC";network:"solana";
}):Promise<string>{
 if(!input.withdrawalId||!input.providerWithdrawalId||input.providerWithdrawalId.startsWith("mock-withdrawal:")||
 !input.masterReceiptId||!input.kalshiWalletAddress||!input.masterWalletAddress||
 input.amountUsdcMicros<=0n||input.asset!=="USDC"||input.network!=="solana")return "invalid_receipt";
 return prisma.$transaction(async tx=>{
  const head=await tx.staffKalshiWithdrawal.findUnique({where:{id:input.withdrawalId}});
  if(!head)return "unrelated";
  await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${head.strategyId} FOR UPDATE`;
  const [item,strategy,master,kBank,mBank]=await Promise.all([
   tx.staffKalshiWithdrawal.findUnique({where:{id:head.id}}),
   tx.strategy.findUnique({where:{id:head.strategyId}}),
   tx.treasury.findUnique({where:{kind:"DEPOSIT"}}),
   tx.treasury.findUnique({where:{kind:"K_BANK"}}),
   tx.treasury.findUnique({where:{kind:"M_BANK"}}),
  ]);
  if(!item||!strategy||!master||!kBank||!mBank)return "mismatch";
  if(item.destinationConfirmed){
   return item.status==="COMPLETED"&&item.providerWithdrawalId===input.providerWithdrawalId&&
    item.masterReceiptId===input.masterReceiptId?"duplicate":"mismatch";
  }
  if(item.status!=="CONFIRMING"||!item.sourceConfirmed||item.destinationConfirmed||
   item.providerWithdrawalId!==input.providerWithdrawalId||item.treasuryTransactionId||
   item.masterReceiptId||item.amountUsdcMicros!==input.amountUsdcMicros||
   item.masterWalletAddress!==input.masterWalletAddress||
   strategy.kalshiWalletAddress!==input.kalshiWalletAddress||
   master.source!=="MASTER_WALLET"||master.asset!=="USDC"||
   master.network!=="solana"||master.walletAddress!==input.masterWalletAddress||
   kBank.source!=="KALSHI"||kBank.asset!=="USDC"||kBank.network!=="solana"||
   mBank.source!=="MASTER_WALLET"||mBank.asset!=="USDC"||
   mBank.walletId!==master.walletId||mBank.walletAddress!==master.walletAddress||
   mBank.network!=="solana")return "not_ready";
  const prior=await tx.treasuryTransfer.findFirst({where:{OR:[
   {originExternalId:input.providerWithdrawalId},
   {destinationExternalId:input.masterReceiptId},
  ]}});
  if(prior)return "mismatch";
  const debit=await tx.treasury.updateMany({where:{kind:"K_BANK",source:"KALSHI",
   amount:{gte:input.amountUsdcMicros}},data:{amount:{decrement:input.amountUsdcMicros}}});
  if(debit.count!==1)throw Error("Insufficient K_BANK for verified return");
  const credit=await tx.treasury.updateMany({where:{kind:"M_BANK",source:"MASTER_WALLET",
   walletId:master.walletId},data:{amount:{increment:input.amountUsdcMicros}}});
  if(credit.count!==1)throw Error("Master bank unavailable");
  const transfer=await tx.treasuryTransfer.create({data:{
   direction:"PLATFORM_K_BANK",status:"COMPLETE",asset:"USDC",
   amountUsdcMicros:input.amountUsdcMicros,feeUsdcMicros:0n,
   network:"solana",masterWalletId:master.walletId,masterWalletAddress:master.walletAddress,
   destinationWalletAddress:master.walletAddress,originExternalId:input.providerWithdrawalId,
   destinationExternalId:input.masterReceiptId,
   reference:`platform_kalshi_return:${item.id}`,completedAt:new Date(),
  }});
  const updated=await tx.staffKalshiWithdrawal.updateMany({where:{
   id:item.id,status:"CONFIRMING",sourceConfirmed:true,destinationConfirmed:false,
   treasuryTransactionId:null,masterReceiptId:null,providerWithdrawalId:input.providerWithdrawalId,
  },data:{status:"COMPLETED",destinationConfirmed:true,
   masterReceiptId:input.masterReceiptId,treasuryTransactionId:transfer.id}});
  if(updated.count!==1)throw Error("Concurrent staff Kalshi return settlement");
  await tx.staffAudit.create({data:{actorId:"blockradar_webhook",
   action:"kalshi.withdrawal.completed",resource:"wallets",targetId:item.id}});
  return "completed";
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:20000});
}
