import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";
import {submitMockKalshiWithdrawal} from "./kalshi-withdrawal-mock.ts";
/** Shutdown coordination reuses the existing pooled StrategyEvent model.
 * A single event represents all remaining investors. Simulated Kalshi acceptance
 * never authenticates custody nor credits users. */
export async function processStrategyShutdowns(){
 const strategies=await prisma.strategy.findMany({where:{status:"SHUTTING_DOWN"},select:{id:true},take:20});
 const outcomes:string[]=[];
 for(const strategy of strategies){
  const result=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${strategy.id} FOR UPDATE`;
   const activeTrades=await tx.strategyTrade.count({where:{strategyId:strategy.id,
    OR:[{status:{in:["AWAITING_ALLOCATION","TRADING","ERROR"]}},{status:"SETTLED",isPnlCalculated:false}]}});
   if(activeTrades)return "WAITING_FOR_TRADE_SETTLEMENT";
   const pendingAllocation=await tx.positionAllocation.count({where:{strategyId:strategy.id,kind:"ALLOCATE",
    status:{notIn:["COMPLETED","FAILED","CANCELLED"]}}});
   if(pendingAllocation)return "WAITING_FOR_ALLOCATIONS";
   const unresolved=await tx.strategyEvent.count({where:{strategyId:strategy.id,kind:"DEALLOCATE",
    status:{not:"COMPLETED"}}});
   if(unresolved)return "WAITING_FOR_VERIFIED_RETURN";
   const positions=await tx.investorPosition.findMany({where:{strategyId:strategy.id},orderBy:{id:"asc"}});
   if(positions.some(p=>p.status==="OPEN"||p.allocatedUsdcMicros<0n))return "WAITING_FOR_POSITION_CLOSING";
   const pending=await tx.positionAllocation.count({where:{strategyId:strategy.id,kind:"DEALLOCATE",
    status:{notIn:["COMPLETED","FAILED","CANCELLED"]}}});
   if(pending)return "WAITING_FOR_EXISTING_DEALLOCATIONS";
   const settled=await tx.positionTradePnl.count({where:{strategyTrade:{strategyId:strategy.id},status:"SNAPSHOTTED"}});
   if(settled)return "WAITING_FOR_PNL";
   const remaining=positions.filter(p=>p.allocatedUsdcMicros>0n);
   const strategyRecord=await tx.strategy.findUniqueOrThrow({where:{id:strategy.id}});
   if(remaining.length===0){
    if(strategyRecord.shutdownEventId){
      const event=await tx.strategyEvent.findUnique({where:{id:strategyRecord.shutdownEventId}});
      if(!event||event.status!=="COMPLETED"||!event.destinationConfirmed||!event.sourceConfirmed)
       return "WAITING_FOR_VERIFIED_SHUTDOWN_SETTLEMENT";
    }
    if(positions.some(p=>p.status!=="CLOSED"&&p.allocatedUsdcMicros!==0n))return "WAITING_FOR_POSITIONS";
    await tx.investorPosition.updateMany({where:{strategyId:strategy.id,status:"CLOSING",allocatedUsdcMicros:0n},data:{status:"CLOSED",closedAt:new Date()}});
    await tx.strategy.update({where:{id:strategy.id},data:{status:"SHUTDOWN",isActive:false,isPublic:false}});
    await tx.botApiKey.updateMany({where:{bot:{strategyId:strategy.id},revokedAt:null},data:{revokedAt:new Date()}});
    return "SHUTDOWN";
   }
   // Do not send a new request if an earlier pooled deallocation exists,
   // including one already completed but not yet applied to position equity.
   // Earlier completed investor deallocations do not justify a second
   // shutdown payout; shutdownEventId is the unique durable claim.
   if(strategyRecord.shutdownEventId)return "WAITING_FOR_SHUTDOWN_RETURN_SETTLEMENT";
   const amount=remaining.reduce((n,p)=>n+p.allocatedUsdcMicros,0n);
   if(!amount)return "WAITING_FOR_AMOUNT";
   const s=await tx.strategy.findUniqueOrThrow({where:{id:strategy.id}});
   if(!s.blockRadarAddress||!s.kalshiWalletAddress)return "MISSING_CUSTODY_WALLETS";
   const event=await tx.strategyEvent.create({data:{
    strategyId:strategy.id,kind:"DEALLOCATE",status:"PROCESSING",amountUsdcMicros:amount
   }});
   // Lock the single-shutdown intent in the same serializable transaction
   // as the individual position principal reservations.
   const claimed=await tx.strategy.updateMany({where:{id:strategy.id,status:"SHUTTING_DOWN",shutdownEventId:null},
    data:{shutdownEventId:event.id}});
   if(claimed.count!==1)throw Error("Shutdown already claimed");
   for(const pos of remaining){
    const debited=await tx.investorPosition.updateMany({where:{
      id:pos.id,status:"CLOSING",allocatedUsdcMicros:pos.allocatedUsdcMicros},
      data:{allocatedUsdcMicros:{decrement:pos.allocatedUsdcMicros},lastPnlUpdated:true}});
    if(debited.count!==1)throw Error("Shutdown position changed before reservation");
   }
   await tx.positionAllocation.createMany({data:remaining.map(p=>({
    userId:p.userId,positionId:p.id,strategyId:strategy.id,
    kind:"DEALLOCATE" as const,amountUsdcMicros:p.allocatedUsdcMicros,
    status:"PROCESSING" as const,strategyEventId:event.id
   }))});
   return {eventId:event.id,amount,destination:s.blockRadarAddress};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:20000});
  if(typeof result==="string"){outcomes.push(strategy.id+":"+result);continue}
  try{
   const receipt=await submitMockKalshiWithdrawal({
    eventId:result.eventId,amountUsdcMicros:result.amount,destination:result.destination
   });
   // This is NOT verification. Never mark sourceConfirmed or credit investors.
   outcomes.push(strategy.id+":"+(receipt.mocked?"MOCK_ACCEPTED_AWAITING_VERIFIED_RETURN":"REVIEW"));
  }catch{
   // Unknown submission status is durable and must never be automatically
   // resubmitted. One pooled event remains pending external reconciliation.
   await prisma.positionAllocation.updateMany({where:{strategyEventId:result.eventId,status:"PROCESSING"},data:{status:"REVIEW"}});
   outcomes.push(strategy.id+":REVIEW");
  }
 }
 return outcomes;
}
