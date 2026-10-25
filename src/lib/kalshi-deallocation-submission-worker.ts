import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";
import {submitMockKalshiWithdrawal} from "./kalshi-withdrawal-mock.ts";

/** The existing Kalshi adapter currently returns a simulated HTTP 200.
 * This authorizes only PROCESSING, never CONFIRMING or investor credit.
 */
export async function processMockDeallocationSubmissions(){
 const first=await prisma.positionAllocation.findFirst({where:{
  kind:"DEALLOCATE",status:"AWAITING_DEALLOCATION",strategyEventId:null,
  position:{status:{in:["OPEN","CLOSING"]},strategy:{blockRadarAddress:{not:null}}}
 },orderBy:[{createdAt:"asc"},{id:"asc"}],include:{position:{include:{strategy:true}}}});
 if(!first)return "empty";
 const claimed=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${first.strategyId} FOR UPDATE`;
  const operation=await tx.positionAllocation.findUnique({where:{id:first.id}});
  if(!operation||operation.status!=="AWAITING_WITHDRAWAL"||operation.strategyEventId)return null;
  const event=await tx.strategyEvent.create({data:{
   strategyId:first.strategyId,kind:"DEALLOCATE",status:"PROCESSING",
   amountUsdcMicros:operation.amountUsdcMicros
  }});
  const changed=await tx.positionAllocation.updateMany({where:{id:operation.id,status:"AWAITING_DEALLOCATION",strategyEventId:null},
   data:{status:"DEALLOCATING",strategyEventId:event.id}});
  if(changed.count!==1)throw new Error("Deallocation submission raced");
  return {eventId:event.id,amount:operation.amountUsdcMicros};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 if(!claimed)return "already_claimed";
 try{
  const destination=first.position.strategy.blockRadarAddress;
  if(!destination)throw new Error("Strategy Blockradar address unconfigured");
  const response=await submitMockKalshiWithdrawal({eventId:claimed.eventId,amountUsdcMicros:claimed.amount,
   destination});
  if(response.status!==200||!response.mocked)throw new Error("Invalid mock response");
  // A stub HTTP 200 means accepted for processing, NOT transferred or received.
  // Neither CONFIRMING nor AWAITING_DEALLOCATION can be reached from this response.
  await prisma.positionAllocation.updateMany({where:{strategyEventId:claimed.eventId,status:"DEALLOCATING"},
   data:{status:"PROCESSING"}});
  return "mock_accepted_processing";
 }catch{
  await prisma.positionAllocation.updateMany({where:{strategyEventId:claimed.eventId,status:"DEALLOCATING"},
   data:{status:"REVIEW"}});
  return "review_pending";
 }
}
