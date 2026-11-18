import {prisma} from "@/lib/db";
import {currentBotManager} from "@/lib/bot-manager-access";
import {calculateMonthlyBotStrategySplit,utcMonthWindow} from "@/lib/bot-manager-monthly-accounting";
export const dynamic="force-dynamic";
export const runtime="nodejs";
/** Read-only month-closing reconciliation. Never creates payment entitlements.
 * Cost evidence can only be supplied by a future trusted provider reconciliation
 * job; this endpoint has no writer or approval override. */
export async function GET(request:Request){
 const ownerId=await currentBotManager();
 if(!ownerId)return Response.json({error:"Bot Manager authorization required"},{status:403});
 const params=new URL(request.url).searchParams;
 const strategyId=params.get("strategy_id"),month=params.get("month");
 if(!strategyId||strategyId.length>64||!month)
  return Response.json({error:"strategy_id and YYYY-MM month required"},{status:400});
 let start:Date,end:Date;
 try{({start,end}=utcMonthWindow(month))}catch{
  return Response.json({error:"Invalid UTC accounting month"},{status:400});
 }
 const bot=await prisma.bot.findFirst({where:{strategyId,ownerId},
  select:{id:true,strategy:{select:{custodyVerifiedAt:true,venueVerifiedAt:true}}}});
 if(!bot)return Response.json({error:"Strategy not owned by manager"},{status:403});
 if(end.getTime()>Date.now())return Response.json({
  status:"OPEN_PERIOD",month,strategy_id:strategyId,payable:false
 },{headers:{"Cache-Control":"no-store"}});
 const [trades,unresolved]=await Promise.all([
  prisma.strategyTrade.findMany({where:{strategyId,settledAt:{gte:start,lt:end}},
   select:{id:true,status:true,isPnlCalculated:true,realizedPnlUsdcMicros:true,
    appliedManagerProfitPercentage:true,appliedPlatformStrategyPercentage:true,
    botVerifiedCosts:true}}),
  prisma.strategyTrade.count({where:{strategyId,createdAt:{gte:start,lt:end},
   OR:[{status:{not:"SETTLED"}},{settledAt:null}]} })
 ]);
 const response=(status:string,details:Record<string,unknown>={})=>Response.json({
  strategy_id:strategyId,month,status,payable:false,manager_earnings_usdc_micros:"0",
  ...details
 },{headers:{"Cache-Control":"no-store"}});
 if(unresolved)return response("PENDING_TRADE_SETTLEMENT",{unresolved_trades:unresolved});
 if(!trades.length)return response("NO_VERIFIED_TRADES");
 const complete=trades.every(t=>t.status==="SETTLED"&&t.realizedPnlUsdcMicros!==null&&
  t.appliedManagerProfitPercentage!==null&&t.appliedPlatformStrategyPercentage!==null&&
  t.botVerifiedCosts?.verifiedAt&&t.botVerifiedCosts.grossPreCostVerified&&
  t.botVerifiedCosts.venueEvidenceRef.trim()&&t.botVerifiedCosts.custodyEvidenceRef.trim()&&
  t.botVerifiedCosts.operationsEvidenceRef.trim());
 if(!complete)return response("PENDING_VERIFIED_COST_EVIDENCE",{
  total_settled_trades:trades.length,
  missing_evidence:trades.filter(t=>!t.botVerifiedCosts?.verifiedAt||
   !t.botVerifiedCosts.grossPreCostVerified||!t.appliedManagerProfitPercentage||
   !t.appliedPlatformStrategyPercentage).length
 });
 try{
  const calculation=calculateMonthlyBotStrategySplit(trades.map(t=>({
   id:t.id,grossMicros:t.realizedPnlUsdcMicros!,
   venueFeeMicros:t.botVerifiedCosts!.venueFeeMicros,
   custodyFeeMicros:t.botVerifiedCosts!.custodyFeeMicros,
   operationalFeeMicros:t.botVerifiedCosts!.operationalFeeMicros,
   managerRate:t.appliedManagerProfitPercentage!.toFixed(4),
   platformRate:t.appliedPlatformStrategyPercentage!.toFixed(4)
  })));
  // Independently verified custody binding is a separate requirement. Even if
  // timestamps exist, there is no payout action or approved bank liability.
  return response("CALCULATED_AWAITING_CUSTODY_RECONCILIATION",{
   is_verified_cost_basis:true,custody_configuration_verified:Boolean(
    bot.strategy.custodyVerifiedAt&&bot.strategy.venueVerifiedAt),
   net_profit_usdc_micros:calculation.net.toString(),
   gross_profit_usdc_micros:calculation.gross.toString(),
   total_verified_cost_usdc_micros:calculation.costs.toString(),
   hypothetical_manager_share_usdc_micros:calculation.manager.toString(),
   hypothetical_platform_share_usdc_micros:calculation.platform.toString(),
   hypothetical_investor_share_usdc_micros:calculation.investors.toString(),
   settled_trade_count:calculation.tradeCount,
   payout_cycle:"MONTHLY_AFTER_VERIFIED_RECONCILIATION",
   loss_policy:"OFFSET_WITHIN_MONTH_ONLY_NO_CARRY_NO_HIGH_WATER_MARK"
  });
 }catch{return response("RECONCILIATION_INCONSISTENT",{error:"Verified fee totals or frozen percentages inconsistent"})}
}
