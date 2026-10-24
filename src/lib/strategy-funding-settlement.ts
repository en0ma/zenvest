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
  // Prevent one Kalshi receipt being attributed to more than one event.
  const used=await tx.treasuryTransfer.findFirst({where:{destinationExternalId:receipt.kalshiTransactionId,
   direction:"ALLOCATE",id:{not:event.treasuryTransactionId}}});
  if(used)return "mismatch";
  const claimed=await tx.strategyEvent.updateMany({
   where:{id:event.id,kind:"ALLOCATE",status:"CONFIRMING",sourceConfirmed:true,destinationConfirmed:false},
   data:{status:"COMPLETED",destinationConfirmed:true},
  });
  if(claimed.count!==1)return "duplicate";
  const moved=await tx.treasuryTransfer.updateMany({
   where:{id:event.treasuryTransactionId,direction:"ALLOCATE",status:"PROCESSING",destinationExternalId:null},
   data:{status:"COMPLETE",destinationExternalId:receipt.kalshiTransactionId,completedAt:new Date()},
  });
  if(moved.count!==1)throw new Error("Treasury receipt mismatch");
  const count=await tx.positionAllocation.updateMany({
   where:{strategyEventId:event.id,kind:"ALLOCATE",status:"CONFIRMING"},
   data:{status:"COMPLETED"},
  });
  if(count.count!==event.positionEvents.length)throw new Error("Allocation batch changed");
  const capacity=await tx.strategy.updateMany({
   where:{id:event.strategyId,availableCapacityUsdcMicros:{gte:event.amountUsdcMicros}},
   data:{availableCapacityUsdcMicros:{decrement:event.amountUsdcMicros}},
  });
  if(capacity.count!==1)throw new Error("Strategy capacity mismatch");
  for(const row of event.positionEvents){
   const debit=await tx.user.updateMany({
    where:{id:row.userId,unallocated:{gte:row.amountUsdcMicros}},
    data:{unallocated:{decrement:row.amountUsdcMicros}},
   });
   if(debit.count!==1)throw new Error("Investor balance mismatch");
   await tx.investorPosition.update({where:{id:row.positionId},
    data:{allocatedUsdcMicros:{increment:row.amountUsdcMicros}}});
   await tx.investorActivity.create({data:{
    userId:row.userId,type:"ALLOCATION",amountKobo:0n,
    amountUsdcMicros:row.amountUsdcMicros,
    reference:`allocation:${row.id}:completed`,
    description:"Independently verified strategy funding",
   }});
  }
  await tx.treasury.update({where:{kind:"ALLOCATE"},
   data:{amount:{increment:event.amountUsdcMicros}}});
  return "settled";
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
