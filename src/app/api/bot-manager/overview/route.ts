import {prisma} from "@/lib/db";
import {currentBotManager} from "@/lib/bot-manager-access";
export const dynamic="force-dynamic";
export async function GET(){
 const ownerId=await currentBotManager();
 if(!ownerId)return Response.json({error:"Bot manager role required"},{status:403});
 const bots=await prisma.bot.findMany({where:{ownerId},take:100,
  include:{strategy:{select:{
   id:true,publicKey:true,status:true,name:true,venue:true,eventTag:true,
   minAllocationUsdcMicros:true,maxAllocationUsdcMicros:true,
   maxCapacityUsdcMicros:true,availableCapacityUsdcMicros:true,
   managerProfitPercentage:true,platformStrategyPercentage:true,
   kalshiWalletAddress:true,blockRadarAddress:true,sandboxAccount:true
  }}},orderBy:{createdAt:"desc"}});
 const keys=await prisma.botApiKey.findMany({where:{ownerId},select:{id:true,label:true,keyPrefix:true,revokedAt:true,lastUsedAt:true}});
 const strategyIds=bots.map(x=>x.strategyId);
 const [positions,pnl,fills,settlements,pending,unsettled,returnEvents,rateRows,versions]=await Promise.all([
  prisma.investorPosition.groupBy({by:["strategyId"],where:{strategyId:{in:strategyIds},status:{in:["OPEN","CLOSING"]}},
   _sum:{allocatedUsdcMicros:true},_count:{_all:true}}),
  prisma.positionTradePnl.findMany({where:{strategyTrade:{strategyId:{in:strategyIds}},status:"SETTLED"},
   select:{netPnlUsdcMicros:true,grossPnlUsdcMicros:true,settledAt:true,strategyTrade:{select:{strategyId:true}}}}),
  prisma.sandboxFill.findMany({where:{strategyId:{in:strategyIds}},take:1000,orderBy:{createdAt:"desc"},
   select:{strategyId:true,orderType:true,realizedPnlMicros:true,estimatedFeeMicros:true,createdAt:true}}),
  prisma.sandboxSettlement.groupBy({by:["strategyId"],where:{strategyId:{in:strategyIds}},_count:{_all:true}}),
  prisma.positionAllocation.groupBy({by:["strategyId","kind"],where:{strategyId:{in:strategyIds},
   status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","AWAITING_DEALLOCATION","AWAITING_WITHDRAWAL","REVIEW"]}},
   _sum:{amountUsdcMicros:true},_count:{_all:true}}),
  prisma.strategyTrade.groupBy({by:["strategyId"],where:{strategyId:{in:strategyIds},OR:[
   {status:{in:["AWAITING_ALLOCATION","TRADING","ERROR"]}},{status:"SETTLED",isPnlCalculated:false}
  ]},_count:{_all:true}}),
  prisma.strategyEvent.findMany({where:{strategyId:{in:strategyIds},kind:"DEALLOCATE"},
   select:{strategyId:true,status:true,sourceConfirmed:true,destinationConfirmed:true,amountUsdcMicros:true}}),
  prisma.botApiRateLimit.findMany({where:{keyId:{in:keys.map(x=>x.id)},windowStart:{
   gte:new Date(Date.now()-3600000)}},select:{keyId:true,requestCount:true,windowStart:true}}),
  prisma.strategyRevenueRateVersion.findMany({where:{strategyId:{in:strategyIds}},
   select:{strategyId:true,managerPct:true,platformPct:true,effectiveAt:true},orderBy:{effectiveAt:"desc"},take:100})
 ]);
 const strategyData=bots.map(({strategy:s,...bot})=>{
  const position=positions.find(x=>x.strategyId===s.id);
  const sandbox=s.sandboxAccount;
  const sandboxFills=fills.filter(x=>x.strategyId===s.id);
  const closed=settlements.find(x=>x.strategyId===s.id);
  const realized=pnl.filter(x=>x.strategyTrade.strategyId===s.id);
  const waiting=pending.filter(x=>x.strategyId===s.id);
  return {
   bot_id:bot.id,strategy_id:s.id,strategy_pubkey:s.publicKey,name:bot.name,status:s.status,
   venue:s.venue,asset:s.eventTag,
   custody_ready:Boolean(s.kalshiWalletAddress&&s.blockRadarAddress),
   capacity_usdc_micros:s.maxCapacityUsdcMicros.toString(),
   available_capacity_usdc_micros:s.availableCapacityUsdcMicros.toString(),
   allocated_usdc_micros:(position?._sum.allocatedUsdcMicros??0n).toString(),
   investor_position_count:position?._count._all??0,
   sandbox:{
    label:"SIMULATED_ONLY",fills:sandboxFills.length,settled_events:closed?._count._all??0,
    realized_pnl_usdc_micros:(sandbox?.realizedPnlMicros??0n).toString(),
    virtual_cash_usdc_micros:(sandbox?.cashMicros??10000000000n).toString(),
    drawdown_bps:sandbox?.maxDrawdownBps??0,
    estimated_fees_usdc_micros:sandboxFills.reduce((n,x)=>n+x.estimatedFeeMicros,0n).toString()
   },
   live:{
    label:"VERIFIED_SETTLED_ONLY",settled_participant_records:realized.length,
    investor_net_realized_pnl_usdc_micros:realized.reduce((n,x)=>n+(x.netPnlUsdcMicros??0n),0n).toString(),
    unrealized_pnl_usdc_micros:null
   },
   manager_profit_pct:s.managerProfitPercentage.toFixed(4),
   platform_profit_pct:s.platformStrategyPercentage.toFixed(4),
   pending_allocation_usdc_micros:waiting.filter(x=>x.kind==="ALLOCATE").reduce((n,x)=>n+(x._sum.amountUsdcMicros??0n),0n).toString(),
   pending_deallocation_usdc_micros:waiting.filter(x=>x.kind==="DEALLOCATE").reduce((n,x)=>n+(x._sum.amountUsdcMicros??0n),0n).toString(),
   unresolved_trade_count:unsettled.find(x=>x.strategyId===s.id)?._count._all??0,
   pooled_returns:returnEvents.filter(x=>x.strategyId===s.id).map(x=>({
    status:x.status,source_verified:x.sourceConfirmed,destination_verified:x.destinationConfirmed,
    amount_usdc_micros:x.amountUsdcMicros.toString()
   })),
   percentage_history:versions.filter(x=>x.strategyId===s.id).map(x=>({
    manager_pct:x.managerPct.toFixed(4),platform_pct:x.platformPct.toFixed(4),effective_at:x.effectiveAt
   }))
  };
 });
 return Response.json({
  strategies:strategyData,
  api_keys:keys.map(k=>({...k,api_calls_last_hour:rateRows.filter(r=>r.keyId===k.id).reduce((n,r)=>n+r.requestCount,0),
   limit_per_minute:60})),
  manager_revenue:{status:"PAYOUT_NOT_ENABLED",recognized_usdc_micros:"0",
    statements:[],payout_history:[],note:"Verified manager profit-sharing accrual and custody settlement remain unconnected."}
 },{headers:{"Cache-Control":"no-store"}});
}
