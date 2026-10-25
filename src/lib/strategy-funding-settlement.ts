import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";

// This is a DOMAIN settlement function, not a Kalshi webhook parser or endpoint.
// Caller MUST independently authenticate Kalshi and verify that the credited
// transaction matches the strategy wallet, asset, network, amount and event.
// Do not expose this function to an unauthenticated HTTP request.
export type VerifiedStrategyFundingReceipt={
 strategyEventId:string;
 kalshiTransactionId:string;
 strategyWalletAddress:string;
 amountUsdcMicros:bigint;
 asset:"USDC";
 network:"solana";
};
export async function settleVerifiedStrategyFunding(receipt:VerifiedStrategyFundingReceipt){
 if(!receipt.kalshiTransactionId||!receipt.strategyWalletAddress||
  receipt.amountUsdcMicros<=0n||receipt.asset!=="USDC"||receipt.network!=="solana")return "invalid_receipt";
 return prisma.$transaction(async tx=>{
  const lockId=await tx.strategyEvent.findUnique({where:{id:receipt.strategyEventId},select:{strategyId:true}});
  if(lockId)await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${lockId.strategyId} FOR UPDATE`;
  const event=await tx.strategyEvent.findUnique({where:{id:receipt.strategyEventId},
   include:{strategy:true,positionEvents:true,treasuryTransaction:true}});
  if(!event||event.kind!=="ALLOCATE")return "unrelated";
  if(event.destinationConfirmed)return event.treasuryTransaction?.destinationExternalId===receipt.kalshiTransactionId?"duplicate":"mismatch";
  if(!event.sourceConfirmed||event.status!=="CONFIRMING"||!event.treasuryTransactionId||
   !event.treasuryTransaction||event.treasuryTransaction.status!=="PROCESSING")return "awaiting_source_confirmation";
  if(event.strategy.kalshiWalletAddress!==receipt.strategyWalletAddress||
   event.amountUsdcMicros!==receipt.amountUsdcMicros||
   event.treasuryTransaction.amountUsdcMicros!==receipt.amountUsdcMicros||
   event.treasuryTransaction.destinationWalletAddress!==receipt.strategyWalletAddress||
   event.positionEvents.length===0||
   event.positionEvents.some(p=>p.kind!=="ALLOCATE"||p.strategyId!==event.strategyId||
    p.status!=="CONFIRMING")||
   event.positionEvents.reduce((a,p)=>a+p.amountUsdcMicros,0n)!==receipt.amountUsdcMicros)
   return "mismatch";
  // Foreign keys prove that each entity exists, not that a position event
  // belongs to the referenced investor and market. Reject inconsistent rows
  // before changing the treasury or investor balances.
  const positionIds=[...new Set(event.positionEvents.map(row=>row.positionId))];
  const positions=await tx.investorPosition.findMany({
   where:{id:{in:positionIds}},select:{id:true,userId:true,strategyId:true,status:true},
  });
  const positionById=new Map(positions.map(pos=>[pos.id,pos]));
  if(event.positionEvents.some(row=>{
   const pos=positionById.get(row.positionId);
   return row.amountUsdcMicros<=0n||row.userId!==pos?.userId||
    row.strategyId!==pos?.strategyId||pos?.strategyId!==event.strategyId||
    pos.status!=="OPEN";
  }))return "mismatch";
  // Reject duplicate references to a single allocation, even if the event
  // relationship was corrupted outside the usual API path.
  if(new Set(event.positionEvents.map(row=>row.id)).size!==event.positionEvents.length)
   return "mismatch";
  // Prevent one Kalshi receipt being attributed to more than one event.
  const used=await tx.treasuryTransfer.findFirst({where:{destinationExternalId:receipt.kalshiTransactionId,
   direction:"ALLOCATE",id:{not:event.treasuryTransactionId}}});
  if(used)return "mismatch";
  // The independently verified Kalshi receipt completes custody confirmation.
  // Do not change investor capital until the P&L worker reaches a safe boundary.
  const moved=await tx.treasuryTransfer.updateMany({
   where:{id:event.treasuryTransactionId,direction:"ALLOCATE",status:"PROCESSING",destinationExternalId:null},
   data:{status:"COMPLETE",destinationExternalId:receipt.kalshiTransactionId,completedAt:new Date()},
  });
  if(moved.count!==1)throw new Error("Treasury receipt mismatch");
  const count=await tx.positionAllocation.updateMany({
   where:{strategyEventId:event.id,kind:"ALLOCATE",status:"CONFIRMING"},
   data:{status:"AWAITING_ALLOCATION"},
  });
  if(count.count!==event.positionEvents.length)throw new Error("Allocation batch changed");
  await tx.strategyEvent.update({where:{id:event.id},data:{destinationConfirmed:true}});
  return "awaiting_allocation";

 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
