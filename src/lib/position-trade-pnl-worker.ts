import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";
import {distributeWeightedMicros,platformProfitFee} from "./position-pnl-math.ts";
import {applyVerifiedCapitalBeforeSnapshots,reservePendingDeallocationsBeforeSnapshots} from "./position-capital-application.ts";

const SERIALIZABLE=Prisma.TransactionIsolationLevel.Serializable;
function percentageUnits(value:Prisma.Decimal):bigint{
 const s=value.toFixed(4),m=/^(\d+)\.(\d{4})$/.exec(s);
 if(!m)throw new Error("Invalid platform percentage");
 const n=BigInt(m[1])*10000n+BigInt(m[2]);
 if(n<0n||n>1000000n)throw new Error("Platform percentage must be 0..100");
 return n;
}
async function withStrategyLock<T>(tx:Prisma.TransactionClient,id:string,fn:()=>Promise<T>):Promise<T>{
 // Shared row lock: funding and deallocation settlement must use the same convention.
 await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${id} FOR UPDATE`;
 return fn();
}
async function settleTrade(id:string){
 return prisma.$transaction(async tx=>{
  const trade=await tx.strategyTrade.findUnique({where:{id},include:{positionTradePnls:true}});
  if(!trade||trade.status!=="SETTLED"||trade.isPnlCalculated)return "already_processed";
  return withStrategyLock(tx,trade.strategyId,async()=>{
   const previous=await tx.strategyTrade.findFirst({where:{
    strategyId:trade.strategyId,id:{not:id},createdAt:{lt:trade.createdAt},
    OR:[{status:{in:["AWAITING_ALLOCATION","TRADING","ERROR"]}},{status:"SETTLED",isPnlCalculated:false}]
   }});
   if(previous)return "waiting_for_prior_event";
   if(trade.realizedPnlUsdcMicros===null||!trade.settledAt) return "awaiting_verified_result";
   const rows=trade.positionTradePnls;
   if(!rows.length||rows.some(p=>p.status!=="SNAPSHOTTED"))throw new Error("Missing or invalid frozen investor exposure");
   const total=rows.reduce((n,p)=>n+p.eligibleCapitalUsdcMicros,0n);
   if(total!==trade.eligibleCapitalUsdcMicros||total<=0n)throw new Error("Trade exposure mismatch");
   if(!trade.appliedPlatformProfitPercentage)throw new Error("Missing frozen platform fee rate");
   const gross=trade.realizedPnlUsdcMicros;
   const fee=platformProfitFee(gross,trade.appliedPlatformProfitPercentage.toFixed(4));
   const grossShares=distributeWeightedMicros(gross,rows.map(p=>({id:p.id,eligibleCapitalUsdcMicros:p.eligibleCapitalUsdcMicros})));
   const feeShares=distributeWeightedMicros(fee,rows.map(p=>({id:p.id,eligibleCapitalUsdcMicros:p.eligibleCapitalUsdcMicros})));
   for(const row of rows.sort((a,b)=>a.positionId.localeCompare(b.positionId))){
    const g=grossShares.get(row.id)??0n,f=feeShares.get(row.id)??0n,net=g-f;
    const updated=await tx.positionTradePnl.updateMany({where:{id:row.id,status:"SNAPSHOTTED"},
     data:{grossPnlUsdcMicros:g,platformFeeUsdcMicros:f,netPnlUsdcMicros:net,status:"SETTLED",settledAt:new Date()}});
    if(updated.count!==1)throw new Error("Position trade posting raced");
    const position=await tx.investorPosition.updateMany({where:{
     id:row.positionId,allocatedUsdcMicros:{gte:net<0n?-net:0n},status:{in:["OPEN","CLOSING"]}},
     data:{allocatedUsdcMicros:{increment:net}}});
    if(position.count!==1)throw new Error("Insufficient allocated equity or position state changed");
    await tx.investorActivity.create({data:{userId:row.userId,type:"TRADE_SETTLEMENT",
     amountKobo:0n,amountUsdcMicros:net,reference:`trade-pnl:${trade.id}:${row.positionId}`,
     description:"Settled investor net trading P&L"}});
   }
   const claimed=await tx.strategyTrade.updateMany({where:{id,status:"SETTLED",isPnlCalculated:false},
    data:{isPnlCalculated:true}});
   if(claimed.count!==1)throw new Error("Trade P&L already applied");
   const closing=await tx.investorPosition.findMany({where:{strategyId:trade.strategyId,status:"CLOSING",lastPnlUpdated:false}});
   for(const pos of closing){
    const unsettled=await tx.positionTradePnl.count({where:{positionId:pos.id,status:"SNAPSHOTTED"}});
    if(!unsettled)await tx.investorPosition.updateMany({where:{id:pos.id,status:"CLOSING",lastPnlUpdated:false},
     data:{lastPnlUpdated:true}});
   }
   return "settled";
  });
 },{isolationLevel:SERIALIZABLE,timeout:20000});
}
async function prepareTrade(id:string){
 return prisma.$transaction(async tx=>{
  const trade=await tx.strategyTrade.findUnique({where:{id}});
  if(!trade||trade.status!=="AWAITING_ALLOCATION")return "already_prepared";
  return withStrategyLock(tx,trade.strategyId,async()=>{
   const earlier=await tx.strategyTrade.findFirst({where:{strategyId:trade.strategyId,id:{not:id},
    createdAt:{lt:trade.createdAt},OR:[{status:{in:["AWAITING_ALLOCATION","TRADING","ERROR"]}},{status:"SETTLED",isPnlCalculated:false}]}});
   if(earlier)return "waiting_for_prior_event";
   // A verified transfer cannot be skipped in favor of a fresh exposure snapshot.
   const awaitingCapital=await tx.positionAllocation.count({where:{strategyId:trade.strategyId,
    status:"AWAITING_ALLOCATION"}});
   if(awaitingCapital)return "waiting_for_capital_application";
   const positions=await tx.investorPosition.findMany({where:{strategyId:trade.strategyId,status:"OPEN",
    allocatedUsdcMicros:{gt:0}},orderBy:{id:"asc"}});
   const capital=positions.reduce((n,p)=>n+p.allocatedUsdcMicros,0n);
   if(capital===0n)return "no_eligible_capital";
   const existing=await tx.positionTradePnl.count({where:{strategyTradeId:id}});
   if(existing)return "snapshot_already_exists";
   const strategy=await tx.strategy.findUniqueOrThrow({where:{id:trade.strategyId}});
   if(percentageUnits(strategy.platformProfitPercentage)>1000000n)throw new Error("Invalid fee");
   await tx.positionTradePnl.createMany({data:positions.map(p=>({
    strategyTradeId:id,positionId:p.id,userId:p.userId,eligibleCapitalUsdcMicros:p.allocatedUsdcMicros}))});
   const updated=await tx.strategyTrade.updateMany({where:{id,status:"AWAITING_ALLOCATION"},
    data:{status:"TRADING",eligibleCapitalUsdcMicros:capital,
     appliedPlatformProfitPercentage:strategy.platformProfitPercentage}});
   if(updated.count!==1)throw new Error("Trade authorization raced");
   return "ready";
  });
 },{isolationLevel:SERIALIZABLE,timeout:20000});
}
export async function processPositionTradePnl(){
 // Settle first, then prepare waiting trades; retry serializable conflicts on next cron.
 const pending=await prisma.strategyTrade.findMany({where:{status:"SETTLED",isPnlCalculated:false},
  orderBy:[{marketEnd:"asc"},{createdAt:"asc"},{id:"asc"}],take:20,select:{id:true}});
 const results:string[]=[];
 for(const row of pending)results.push(`settle:${row.id}:${await settleTrade(row.id)}`);
 // P&L is final before verified capital adjustments, which precede new snapshots.
 const capitalResults=await applyVerifiedCapitalBeforeSnapshots();
 results.push(...capitalResults.map(x=>"capital:"+x));
 // Remove withdrawal-bound capital from trade equity before creating any fresh snapshot.
 const reserved=await reservePendingDeallocationsBeforeSnapshots();
 results.push(...reserved.map(x=>"reserve:"+x));
 const awaiting=await prisma.strategyTrade.findMany({where:{status:"AWAITING_ALLOCATION"},
  orderBy:[{marketStart:"asc"},{createdAt:"asc"},{id:"asc"}],take:20,select:{id:true}});
 for(const row of awaiting)results.push(`prepare:${row.id}:${await prepareTrade(row.id)}`);
 return results;
}
