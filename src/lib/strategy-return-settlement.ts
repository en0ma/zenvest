import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";

// Domain boundary only: caller MUST independently verify a Kalshi withdrawal
// and the corresponding master-wallet USDC arrival. Do not expose publicly.
export type VerifiedStrategyReturnReceipt={
 strategyEventId:string;
 kalshiWithdrawalId:string;
 masterReceiptId:string;
 kalshiWalletAddress:string;
 masterWalletAddress:string;
 amountUsdcMicros:bigint;
 asset:"USDC";
 network:"solana";
};
export async function settleVerifiedStrategyReturn(receipt:VerifiedStrategyReturnReceipt){
 if(!receipt.strategyEventId||!receipt.kalshiWithdrawalId||!receipt.masterReceiptId||
  !receipt.kalshiWalletAddress||!receipt.masterWalletAddress||
  receipt.amountUsdcMicros<=0n||receipt.asset!=="USDC"||receipt.network!=="solana")
  return "invalid_receipt";
 return prisma.$transaction(async tx=>{
  const head=await tx.strategyEvent.findUnique({where:{id:receipt.strategyEventId},select:{strategyId:true}});
  if(!head)return "unrelated";
  await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${head.strategyId} FOR UPDATE`;
  const event=await tx.strategyEvent.findUnique({where:{id:receipt.strategyEventId},
   include:{strategy:true,positionEvents:true,treasuryTransaction:true}});
  if(!event||event.kind!=="DEALLOCATE")return "unrelated";
  if(event.destinationConfirmed){
   const transfer=event.treasuryTransaction;
   return transfer?.originExternalId===receipt.kalshiWithdrawalId &&
    transfer?.destinationExternalId===receipt.masterReceiptId?"duplicate":"mismatch";
  }
  const master=await tx.treasury.findUnique({where:{kind:"DEPOSIT"}});
  if(!master||master.source!=="MASTER_WALLET"||
   master.walletAddress!==receipt.masterWalletAddress||
   event.strategy.kalshiWalletAddress!==receipt.kalshiWalletAddress||
   event.amountUsdcMicros!==receipt.amountUsdcMicros||
   event.positionEvents.length===0||
   event.positionEvents.reduce((sum,row)=>sum+row.amountUsdcMicros,0n)!==receipt.amountUsdcMicros||
   event.positionEvents.some(row=>row.kind!=="DEALLOCATE"||
    row.strategyId!==event.strategyId||row.status!=="CONFIRMING"))return "mismatch";
  if(event.treasuryTransactionId||event.sourceConfirmed||event.destinationConfirmed||
   event.status!=="CONFIRMING")return "not_ready";
  // The IDs supplied by the independently authenticated caller must be globally unique.
  const prior=await tx.treasuryTransfer.findFirst({where:{direction:"DEALLOCATE",
   OR:[{originExternalId:receipt.kalshiWithdrawalId},
       {destinationExternalId:receipt.masterReceiptId}]}});
  if(prior)return "mismatch";
  const rows=event.positionEvents;
  const positions=await tx.investorPosition.findMany({where:{id:{in:rows.map(x=>x.positionId)}}});
  const byId=new Map(positions.map(p=>[p.id,p]));
  for(const row of rows){
   const pos=byId.get(row.positionId);
   if(!pos||pos.userId!==row.userId||pos.strategyId!==event.strategyId||
    (pos.status!=="OPEN"&&pos.status!=="CLOSING")||
    (pos.status==="CLOSING"&&!pos.lastPnlUpdated))return "mismatch";
  }
  // Verification records custody; P&L exposure is checked before capital application.
  const transfer=await tx.treasuryTransfer.create({data:{
   direction:"DEALLOCATE",status:"COMPLETE",asset:"USDC",network:"solana",
   amountUsdcMicros:event.amountUsdcMicros,feeUsdcMicros:0n,
   destinationWalletAddress:master.walletAddress,masterWalletAddress:master.walletAddress,
   masterWalletId:master.walletId,originExternalId:receipt.kalshiWithdrawalId,
   destinationExternalId:receipt.masterReceiptId,
   reference:`strategy_return:${event.id}`,completedAt:new Date(),
  }});
  // Custody is independently confirmed, but the position's capital stays
  // unchanged until all earlier frozen trade exposure has settled.
  const changed=await tx.strategyEvent.updateMany({where:{id:event.id,status:"CONFIRMING",
   sourceConfirmed:false,destinationConfirmed:false,treasuryTransactionId:null},
   data:{sourceConfirmed:true,destinationConfirmed:true,treasuryTransactionId:transfer.id}});
  if(changed.count!==1)throw new Error("Concurrent strategy return settlement");
  const queued=await tx.positionAllocation.updateMany({where:{
   strategyEventId:event.id,kind:"DEALLOCATE",status:"CONFIRMING"},
   data:{status:"AWAITING_WITHDRAWAL"}});
  if(queued.count!==rows.length)throw new Error("Return batch changed");
  return "awaiting_withdrawal";

 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:20000});
}
