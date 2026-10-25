import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";

const SERIALIZABLE=Prisma.TransactionIsolationLevel.Serializable;
const VERIFIED=["AWAITING_ALLOCATION"] as const;

/** Apply verified, physically completed transfers only after frozen trade P&L has posted.
 * Both this coordinator and the next-snapshot worker serialize on strategies.id.
 */
export async function applyVerifiedCapitalEvent(eventId:string):Promise<string>{
 return prisma.$transaction(async tx=>{
  const head=await tx.strategyEvent.findUnique({where:{id:eventId},select:{strategyId:true}});
  if(!head)return "missing_event";
  await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${head.strategyId} FOR UPDATE`;
  const event=await tx.strategyEvent.findUnique({where:{id:eventId},
   include:{positionEvents:true,treasuryTransaction:true}});
  if(!event||event.kind!=="ALLOCATE"||event.status!=="CONFIRMING"||!event.sourceConfirmed||!event.destinationConfirmed||
   !event.treasuryTransaction||event.treasuryTransaction.status!=="COMPLETE")return "not_ready";
  const desired=event.kind==="ALLOCATE"?"AWAITING_ALLOCATION":"AWAITING_DEALLOCATION";
  const rows=event.positionEvents;
  if(!rows.length||rows.some(x=>x.kind!==event.kind||x.status!==desired||x.strategyId!==event.strategyId)||
   rows.reduce((sum,x)=>sum+x.amountUsdcMicros,0n)!==event.amountUsdcMicros)return "mismatch";
  const positions=await tx.investorPosition.findMany({where:{id:{in:rows.map(x=>x.positionId)}}});
  const byId=new Map(positions.map(p=>[p.id,p]));
  if(rows.some(row=>{
   const pos=byId.get(row.positionId);
   return !pos||pos.userId!==row.userId||pos.strategyId!==event.strategyId||
    row.amountUsdcMicros<=0n||pos.status!=="OPEN"&&pos.status!=="CLOSING"||
    (event.kind==="ALLOCATE"&&pos.status!=="OPEN")||
    (event.kind==="DEALLOCATE"&&pos.status==="CLOSING"&&!pos.lastPnlUpdated);
  }))return "position_not_ready";
  const exposed=await tx.positionTradePnl.count({where:{
   positionId:{in:rows.map(r=>r.positionId)},status:"SNAPSHOTTED"}});
  if(exposed)return "awaiting_pnl";
  const totals=new Map<string,bigint>();
  for(const row of rows)totals.set(row.positionId,(totals.get(row.positionId)??0n)+row.amountUsdcMicros);
  const claimed=await tx.positionAllocation.updateMany({where:{
   strategyEventId:event.id,kind:event.kind,status:desired},
   data:{status:"COMPLETED"}});
  if(claimed.count!==rows.length)throw new Error("Verified position event changed");
  for(const row of rows){
   if(event.kind==="ALLOCATE"){
    const debit=await tx.user.updateMany({where:{id:row.userId,unallocated:{gte:row.amountUsdcMicros}},
     data:{unallocated:{decrement:row.amountUsdcMicros}}});
    if(debit.count!==1)throw new Error("Insufficient reserved unallocated capital");
    const credited=await tx.investorPosition.updateMany({where:{id:row.positionId,
     userId:row.userId,strategyId:event.strategyId,status:"OPEN"},
     data:{allocatedUsdcMicros:{increment:row.amountUsdcMicros}}});
    if(credited.count!==1)throw new Error("Position state changed during funding");
   }else{
    await tx.user.update({where:{id:row.userId},data:{unallocated:{increment:row.amountUsdcMicros}}});
   }
   await tx.investorActivity.create({data:{
    userId:row.userId,type:event.kind==="ALLOCATE"?"ALLOCATION":"DEALLOCATION",
    amountKobo:0n,amountUsdcMicros:row.amountUsdcMicros,
    reference:(event.kind==="ALLOCATE"?"allocation:":"deallocation:")+row.id+":completed",
    description:event.kind==="ALLOCATE"?"Independently verified strategy funding":"Verified Kalshi withdrawal and master-wallet return"
   }});
  }
  if(event.kind==="ALLOCATE"){
   const capacity=await tx.strategy.updateMany({where:{id:event.strategyId,
    availableCapacityUsdcMicros:{gte:event.amountUsdcMicros}},
    data:{availableCapacityUsdcMicros:{decrement:event.amountUsdcMicros}}});
   if(capacity.count!==1)throw new Error("Strategy capacity mismatch");
   await tx.treasury.update({where:{kind:"ALLOCATE"},
    data:{amount:{increment:event.amountUsdcMicros}}});
  }else{
   await tx.strategy.update({where:{id:event.strategyId},
    data:{availableCapacityUsdcMicros:{increment:event.amountUsdcMicros}}});
   const master=await tx.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
   await tx.treasury.upsert({where:{kind:"DEALLOCATE"},
    create:{walletAddress:master.walletAddress,walletId:master.walletId,source:"MASTER_WALLET",
     kind:"DEALLOCATE",amount:event.amountUsdcMicros},
    update:{amount:{increment:event.amountUsdcMicros}}});
   for(const [id,amount] of totals){
    const original=byId.get(id)!;
    if(original.status==="CLOSING"){
     const closed=await tx.investorPosition.updateMany({where:{
      id,status:"CLOSING",allocatedUsdcMicros:0n,lastPnlUpdated:true},
      data:{status:"CLOSED",closedAt:new Date()}});
     if(closed.count!==1)throw new Error("Closing position changed");
    }
   }
  }
  const finished=await tx.strategyEvent.updateMany({where:{id:event.id,status:"CONFIRMING",
   sourceConfirmed:true,destinationConfirmed:true},data:{status:"COMPLETED"}});
  if(finished.count!==1)throw new Error("Strategy capital event raced");
  return "applied";
 },{isolationLevel:SERIALIZABLE,timeout:20000});
}
/** Reserve/debit a deallocation only at the P&L-to-next-snapshot boundary.
 * The amount is removed from position trading capital before Kalshi is called;
 * user.unallocated is credited only after both withdrawal and sweep verification.
 */
export async function reservePendingDeallocationsBeforeSnapshots():Promise<string[]>{
 const requests=await prisma.positionAllocation.findMany({where:{
  kind:"DEALLOCATE",status:"PENDING",strategyEventId:null},
  orderBy:[{createdAt:"asc"},{id:"asc"}],take:100,
  select:{id:true,strategyId:true}});
 const outcomes:string[]=[];
 for(const request of requests){
  const outcome=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${request.strategyId} FOR UPDATE`;
   const row=await tx.positionAllocation.findUnique({where:{id:request.id}});
   if(!row||row.status!=="PENDING"||row.strategyEventId)return "already_processed";
   const position=await tx.investorPosition.findUnique({where:{id:row.positionId}});
   if(!position||position.userId!==row.userId||position.strategyId!==row.strategyId||
      !["OPEN","CLOSING"].includes(position.status))return "not_ready";
   if(position.status==="CLOSING"&&!position.lastPnlUpdated)return "awaiting_pnl";
   const exposure=await tx.positionTradePnl.count({where:{
    positionId:row.positionId,status:"SNAPSHOTTED"}});
   if(exposure)return "awaiting_pnl";
   const claim=await tx.positionAllocation.updateMany({where:{id:row.id,status:"PENDING",strategyEventId:null},data:{status:"SUBMITTING"}});
   if(claim.count!==1)return "already_processed";
   if(position.allocatedUsdcMicros<row.amountUsdcMicros){
    await tx.positionAllocation.updateMany({where:{id:row.id,status:"SUBMITTING",strategyEventId:null},
      data:{status:"FAILED"}});
    return "failed_insufficient_equity";
   }
   const debited=await tx.investorPosition.updateMany({where:{id:position.id,
    allocatedUsdcMicros:{gte:row.amountUsdcMicros},status:{in:["OPEN","CLOSING"]}},
    data:{allocatedUsdcMicros:{decrement:row.amountUsdcMicros}}});
   if(debited.count!==1)throw new Error("Deallocation reservation raced");
   const reserved=await tx.positionAllocation.updateMany({where:{id:row.id,status:"SUBMITTING",
    strategyEventId:null},data:{status:"AWAITING_DEALLOCATION"}});
   if(reserved.count!==1)throw new Error("Deallocation reservation state raced");
   return "reserved";
  },{isolationLevel:SERIALIZABLE,timeout:20000});
  outcomes.push(request.id+":"+outcome);
 }
 return outcomes;
}
export async function applyVerifiedCapitalBeforeSnapshots():Promise<string[]>{
 const pending=await prisma.strategyEvent.findMany({where:{status:"CONFIRMING",
  sourceConfirmed:true,destinationConfirmed:true,
  positionEvents:{some:{status:{in:[...VERIFIED]}}}},
  orderBy:[{createdAt:"asc"},{id:"asc"}],take:100,select:{id:true}});
 const results:string[]=[];
 for(const event of pending){
  results.push(event.id+":"+await applyVerifiedCapitalEvent(event.id));
 }
 return results;
}
