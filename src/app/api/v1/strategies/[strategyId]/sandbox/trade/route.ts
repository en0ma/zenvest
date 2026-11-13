import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {authorizeBotV1} from "@/lib/bot-v1-access";
import {eventTradeInput,canonicalEventSide} from "@/lib/bot-strategy-api-schema";
import {readKalshiSandboxBook,quoteFromKalshiBook} from "@/lib/kalshi-sandbox-book";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{strategyId:string}>};
/** Virtual execution. Never writes StrategyTrade, PositionAllocation, Treasury,
 * verified P&L, custody, or order instructions to Kalshi. */
export async function POST(request:Request,{params}:Context){
 const {strategyId}=await params;
 const access=await authorizeBotV1(request,strategyId);
 if(!access.ok)return access.response;
 const requestKey=request.headers.get("idempotency-key");
 if(!requestKey||!/^[A-Za-z0-9_-]{8,100}$/.test(requestKey))
  return Response.json({error:"Idempotency-Key required"},{status:400,headers:access.headers});
 let body:unknown;
 try{body=await request.json()}catch{return Response.json({error:"Invalid JSON"},{status:400,headers:access.headers})}
 const parsed=eventTradeInput.safeParse(body);
 if(!parsed.success)return Response.json({error:"Invalid sandbox trade"},{status:400,headers:access.headers});
 const data=parsed.data,side=canonicalEventSide(data.side);
 const existing=await prisma.sandboxFill.findUnique({where:{strategyId_requestKey:{strategyId,requestKey}}});
 if(existing){
  if(existing.orderType!==data.order_type||existing.quantity!==data.trade_size||existing.eventId!==data.event_id||existing.side!==side)
   return Response.json({error:"Idempotency conflict"},{status:409,headers:access.headers});
  return Response.json({fill_id:existing.id,status:"SIMULATED",duplicate:true,notional_usdc_micros:existing.notionalMicros.toString(),
   estimated_fee_usdc_micros:existing.estimatedFeeMicros.toString(),is_real_trade:false},{status:200,headers:access.headers});
 }
 const s=await prisma.strategy.findUnique({where:{id:strategyId},select:{status:true,eventTag:true,venue:true,sandboxFeeBps:true}});
 if(!s||!["ONBOARDING","MONITORING"].includes(s.status)||s.venue!=="kalshi"||!s.eventTag)
  return Response.json({error:"Sandbox available only for configured ONBOARDING/MONITORING Kalshi strategies"},{status:409,headers:access.headers});
 if(s.sandboxFeeBps===null)
  return Response.json({error:"Admin must configure a disclosed sandbox fee estimate before simulations"},{status:409,headers:access.headers});
 let snapshot:Awaited<ReturnType<typeof readKalshiSandboxBook>>;
 let quote:ReturnType<typeof quoteFromKalshiBook>;
 try{
  snapshot=await readKalshiSandboxBook(data.event_id,s.eventTag);
  quote=quoteFromKalshiBook(snapshot.book,side,data.order_type,data.trade_size);
 }catch(error){
  return Response.json({error:error instanceof Error?error.message:"Kalshi market data unavailable"},
   {status:503,headers:access.headers});
 }
 try{
  const result=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${strategyId} FOR UPDATE`;
   const [strategy,bot,key,prior]=await Promise.all([
    tx.strategy.findUnique({where:{id:strategyId},select:{status:true,sandboxFeeBps:true,eventTag:true}}),
    tx.bot.findFirst({where:{ownerId:access.ownerId,strategyId},select:{id:true}}),
    tx.botApiKey.findFirst({where:{id:access.keyId,ownerId:access.ownerId,revokedAt:null}}),
    tx.sandboxFill.findUnique({where:{strategyId_requestKey:{strategyId,requestKey}}})
   ]);
   if(!bot||!key||!strategy||!["ONBOARDING","MONITORING"].includes(strategy.status)||
      strategy.eventTag!==s.eventTag||strategy.sandboxFeeBps===null)return "NOT_ALLOWED";
   if(prior){
    if(prior.orderType!==data.order_type||prior.quantity!==data.trade_size||prior.eventId!==data.event_id||prior.side!==side)return "CONFLICT";
    return {fill:prior,duplicate:true,cash:null};
   }
   const fee=(quote.notionalMicros*BigInt(strategy.sandboxFeeBps)+9999n)/10000n;
   const account=await tx.sandboxAccount.upsert({where:{strategyId},
    create:{strategyId},update:{}});
   const old=await tx.sandboxPosition.findUnique({where:{strategyId_eventId_side:{strategyId,eventId:data.event_id,side}}});
   const quantity=old?.quantity??0,cost=old?.costBasisMicros??0n;
   let cashDelta:bigint,remainingQty:number,remainingCost:bigint,realized=0n;
   if(data.order_type==="buy"){
    cashDelta=-(quote.notionalMicros+fee);
    if(account.cashMicros+cashDelta<0n)return "INSUFFICIENT_VIRTUAL_CASH";
    remainingQty=quantity+data.trade_size;remainingCost=cost+quote.notionalMicros+fee;
   }else{
    if(quantity<data.trade_size)return "INSUFFICIENT_VIRTUAL_POSITION";
    const relieved=cost*BigInt(data.trade_size)/BigInt(quantity);
    realized=quote.notionalMicros-fee-relieved;
    cashDelta=quote.notionalMicros-fee;
    remainingQty=quantity-data.trade_size;
    remainingCost=remainingQty===0?0n:cost-relieved;
   }
   await tx.sandboxPosition.upsert({where:{strategyId_eventId_side:{strategyId,eventId:data.event_id,side}},
    create:{strategyId,eventId:data.event_id,side,quantity:remainingQty,costBasisMicros:remainingCost},
    update:{quantity:remainingQty,costBasisMicros:remainingCost}});
   const cash=account.cashMicros+cashDelta;
   // Realized-cost equity excludes market marks; call it cost-basis equity,
   // never verified unrealized P&L or actual investor capital.
   const equityAtCost=account.initialCashMicros+account.realizedPnlMicros+realized;
   const peak=account.peakEquityMicros>equityAtCost?account.peakEquityMicros:equityAtCost;
   const dd=peak>0n&&peak>equityAtCost?Number((peak-equityAtCost)*10000n/peak):0;
   await tx.sandboxAccount.update({where:{strategyId},data:{
    cashMicros:cash,realizedPnlMicros:{increment:realized},
    peakEquityMicros:peak,maxDrawdownBps:Math.max(account.maxDrawdownBps,dd)
   }});
   const fill=await tx.sandboxFill.create({data:{
    strategyId,keyId:access.keyId,requestKey,eventId:data.event_id,
    side,orderType:data.order_type,quantity:data.trade_size,
    priceMicros:quote.priceMicros,notionalMicros:quote.notionalMicros,
    estimatedFeeMicros:fee,realizedPnlMicros:realized,venueObservedAt:snapshot.observedAt,
    bookSnapshot:{source:"KALSHI_READ_ONLY",market_ticker:data.event_id,
     series:s.eventTag,observed_at:snapshot.observedAt.toISOString(),
     consumed_levels:quote.levels,best_price_micros:quote.bestPriceMicros.toString(),
     worst_price_micros:quote.worstPriceMicros.toString(),fee_kind:"ESTIMATED_ADMIN_BPS"}
   }});
   return {fill,duplicate:false,cash};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:20000});
  if(typeof result==="string")return Response.json({error:result},{status:409,headers:access.headers});
  return Response.json({fill_id:result.fill.id,status:"SIMULATED",duplicate:result.duplicate,is_real_trade:false,
   notional_usdc_micros:result.fill.notionalMicros.toString(),
   estimated_fee_usdc_micros:result.fill.estimatedFeeMicros.toString(),
   realized_virtual_pnl_usdc_micros:result.fill.realizedPnlMicros.toString(),
   virtual_cash_usdc_micros:result.cash?.toString()??null,
   venue_observed_at:result.fill.venueObservedAt.toISOString()},{
    status:result.duplicate?200:201,headers:access.headers
  });
 }catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&["P2002","P2034"].includes(error.code))
   return Response.json({error:"Concurrent sandbox order; retry with same idempotency key"},{status:409,headers:access.headers});
  return Response.json({error:"Sandbox order could not be recorded"},{status:503,headers:access.headers});
 }
}
