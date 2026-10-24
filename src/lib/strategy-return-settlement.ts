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
    (pos.status==="CLOSING"&&!pos.lastPnlUpdated)||
    pos.allocatedUsdcMicros<row.amountUsdcMicros)return "mismatch";
  }
  // Don't remove capital while previously snapshotted trades still carry risk.
  const exposed=await tx.positionTradePnl.count({where:{positionId:{in:rows.map(x=>x.positionId)},status:"SNAPSHOTTED"}});
  if(exposed)return "awaiting_pnl";
  const transfer=await tx.treasuryTransfer.create({data:{
   direction:"DEALLOCATE",status:"COMPLETE",asset:"USDC",network:"solana",
   amountUsdcMicros:event.amountUsdcMicros,feeUsdcMicros:0n,
   destinationWalletAddress:master.walletAddress,masterWalletAddress:master.walletAddress,
   masterWalletId:master.walletId,originExternalId:receipt.kalshiWithdrawalId,
   destinationExternalId:receipt.masterReceiptId,
   reference:`strategy_return:${event.id}`,completedAt:new Date(),
  }});
  const changed=await tx.strategyEvent.updateMany({where:{id:event.id,status:"CONFIRMING",
   sourceConfirmed:false,destinationConfirmed:false,treasuryTransactionId:null},
   data:{status:"COMPLETED",sourceConfirmed:true,destinationConfirmed:true,
    treasuryTransactionId:transfer.id}});
  if(changed.count!==1)throw new Error("Concurrent strategy return settlement");
  const completed=await tx.positionAllocation.updateMany({where:{
   strategyEventId:event.id,kind:"DEALLOCATE",status:"CONFIRMING"},
   data:{status:"COMPLETED"}});
  if(completed.count!==rows.length)throw new Error("Return batch changed");
  for(const row of rows){
   const debited=await tx.investorPosition.updateMany({where:{id:row.positionId,
    status:{in:["OPEN","CLOSING"]},allocatedUsdcMicros:{gte:row.amountUsdcMicros}},
    data:{allocatedUsdcMicros:{decrement:row.amountUsdcMicros}}});
   if(debited.count!==1)throw new Error("Position equity race");
   await tx.user.update({where:{id:row.userId},
    data:{unallocated:{increment:row.amountUsdcMicros}}});
   await tx.investorActivity.create({data:{userId:row.userId,type:"DEALLOCATION",
    amountKobo:0n,amountUsdcMicros:row.amountUsdcMicros,
    reference:`deallocation:${row.id}:completed`,
    description:"Verified Kalshi withdrawal and master-wallet return"}});
   const pos=byId.get(row.positionId)!;
   if(pos.status==="CLOSING"){
    if(pos.allocatedUsdcMicros!==row.amountUsdcMicros)throw new Error("Closing return must cover final equity");
    const closed=await tx.investorPosition.updateMany({where:{id:row.positionId,
     status:"CLOSING",allocatedUsdcMicros:0n,lastPnlUpdated:true},
     data:{status:"CLOSED",closedAt:new Date()}});
    if(closed.count!==1)throw new Error("Closing position not ready");
   }
  }
  await tx.strategy.update({where:{id:event.strategyId},
   data:{availableCapacityUsdcMicros:{increment:event.amountUsdcMicros}}});
  await tx.treasury.upsert({where:{kind:"DEALLOCATE"},
   create:{walletAddress:master.walletAddress,walletId:master.walletId,source:"MASTER_WALLET",
    kind:"DEALLOCATE",amount:event.amountUsdcMicros},
   update:{amount:{increment:event.amountUsdcMicros}}});
  return "settled";
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:20000});
}
