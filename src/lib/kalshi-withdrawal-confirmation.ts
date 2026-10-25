import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";

/** Domain-only function for a FUTURE authenticated Kalshi withdraw.success integration.
 * Never invoke from a mock HTTP 200 or an unauthenticated request.
 */
export async function confirmVerifiedKalshiWithdrawal(input:{
 eventId:string;withdrawalId:string;amountUsdcMicros:bigint;strategyWalletAddress:string;
}):Promise<string>{
 if(!input.eventId||!input.withdrawalId||input.amountUsdcMicros<=0n||!input.strategyWalletAddress)return "invalid";
 return prisma.$transaction(async tx=>{
  const head=await tx.strategyEvent.findUnique({where:{id:input.eventId},select:{strategyId:true}});
  if(!head)return "not_found";
  await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${head.strategyId} FOR UPDATE`;
  const event=await tx.strategyEvent.findUnique({where:{id:input.eventId},
   include:{strategy:true,positionEvents:true}});
  if(!event||event.kind!=="DEALLOCATE"||event.amountUsdcMicros!==input.amountUsdcMicros||
   event.strategy.kalshiWalletAddress!==input.strategyWalletAddress)return "mismatch";
  if(event.sourceConfirmed)return event.kalshiWithdrawalId===input.withdrawalId?"duplicate":"mismatch";
  if(event.status!=="PROCESSING"||!event.positionEvents.length||
   event.positionEvents.some(row=>row.kind!=="DEALLOCATE"||row.status!=="PROCESSING")||
   event.positionEvents.reduce((sum,row)=>sum+row.amountUsdcMicros,0n)!==input.amountUsdcMicros)return "not_ready";
  const updated=await tx.strategyEvent.updateMany({where:{id:event.id,sourceConfirmed:false,status:"PROCESSING",
    kalshiWithdrawalId:null},
   data:{sourceConfirmed:true,status:"CONFIRMING",kalshiWithdrawalId:input.withdrawalId}});
  if(updated.count!==1)return "already_claimed";
  const rows=await tx.positionAllocation.updateMany({where:{strategyEventId:event.id,kind:"DEALLOCATE",status:"PROCESSING"},
   data:{status:"CONFIRMING"}});
  if(rows.count!==event.positionEvents.length)throw Error("Kalshi withdrawal batch changed");
  return "confirming";
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
