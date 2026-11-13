import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {authorizeBotV1} from "@/lib/bot-v1-access";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{strategyId:string}>};
/** Settles a virtual position ONLY from the venue's read-only resolved
 * market state. No caller-supplied winning side or realized P&L is trusted. */
export async function POST(request:Request,{params}:Context){
 const {strategyId}=await params;
 const access=await authorizeBotV1(request,strategyId);
 if(!access.ok)return access.response;
 let body:unknown;
 try{body=await request.json()}catch{return Response.json({error:"Invalid JSON"},{status:400,headers:access.headers})}
 const eventId=(body&&typeof body==="object"&&(body as Record<string,unknown>).event_id);
 if(typeof eventId!=="string"||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/.test(eventId)||
  Object.keys(body as Record<string,unknown>).some(k=>k!=="event_id"))
  return Response.json({error:"Only event_id is accepted"},{status:400,headers:access.headers});
 const s=await prisma.strategy.findUnique({where:{id:strategyId},select:{status:true,eventTag:true,venue:true}});
 if(!s||!["ONBOARDING","MONITORING"].includes(s.status)||s.venue!=="kalshi"||!s.eventTag)
  return Response.json({error:"Not an active sandbox strategy"},{status:409,headers:access.headers});
 const existing=await prisma.sandboxSettlement.findUnique({where:{strategyId_eventId:{strategyId,eventId}}});
 if(existing)return Response.json({settlement_id:existing.id,result:existing.result,
  payout_usdc_micros:existing.payoutMicros.toString(),realized_virtual_pnl_usdc_micros:existing.realizedPnlMicros.toString(),duplicate:true},
  {headers:access.headers});
 let evidence:Record<string,unknown>;
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{
   const response=await fetch("https://external-api.kalshi.com/trade-api/v2/markets/"+encodeURIComponent(eventId),
    {signal:controller.signal,cache:"no-store"});
   if(!response.ok)throw Error("VENUE_UNAVAILABLE");
   const data=await response.json() as Record<string,unknown>;
   evidence=data.market as Record<string,unknown>;
  }finally{clearTimeout(timer)}
 }catch{return Response.json({error:"Authoritative venue result unavailable"},{status:503,headers:access.headers})}
 if(!evidence||evidence.ticker!==eventId||
   (evidence.series_ticker!==s.eventTag&&evidence.event_ticker!==s.eventTag)||
   evidence.status!=="settled"||!["yes","no"].includes(String(evidence.result)))
  return Response.json({error:"Venue market is not verifiably settled for this strategy"},{status:409,headers:access.headers});
 const resultSide=String(evidence.result);
 try{
  const settled=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${strategyId} FOR UPDATE`;
   const [strategy,key,prior]=await Promise.all([
    tx.strategy.findUnique({where:{id:strategyId},select:{status:true,eventTag:true}}),
    tx.botApiKey.findFirst({where:{id:access.keyId,ownerId:access.ownerId,revokedAt:null}}),
    tx.sandboxSettlement.findUnique({where:{strategyId_eventId:{strategyId,eventId}}})
   ]);
   if(!key||!strategy||!["ONBOARDING","MONITORING"].includes(strategy.status)||strategy.eventTag!==s.eventTag)return "NOT_ALLOWED";
   if(prior)return {id:prior.id,payout:prior.payoutMicros,realized:prior.realizedPnlMicros,duplicate:true};
   const positions=await tx.sandboxPosition.findMany({where:{strategyId,eventId,quantity:{gt:0}}});
   if(!positions.length)return "NO_POSITION";
   const payout=positions.reduce((n,p)=>n+(p.side===resultSide?BigInt(p.quantity)*1000000n:0n),0n);
   const cost=positions.reduce((n,p)=>n+p.costBasisMicros,0n);
   const realized=payout-cost;
   const account=await tx.sandboxAccount.findUnique({where:{strategyId}});
   if(!account)return "NO_ACCOUNT";
   const equity=account.initialCashMicros+account.realizedPnlMicros+realized;
   const peak=account.peakEquityMicros>equity?account.peakEquityMicros:equity;
   const drawdown=peak>0n&&peak>equity?Number((peak-equity)*10000n/peak):0;
   await tx.sandboxAccount.update({where:{strategyId},data:{
    cashMicros:{increment:payout},realizedPnlMicros:{increment:realized},
    peakEquityMicros:peak,maxDrawdownBps:Math.max(account.maxDrawdownBps,drawdown)
   }});
   await tx.sandboxPosition.updateMany({where:{strategyId,eventId},data:{quantity:0,costBasisMicros:0n}});
   const row=await tx.sandboxSettlement.create({data:{
    strategyId,eventId,result:resultSide,payoutMicros:payout,realizedPnlMicros:realized,
    observedAt:new Date(),providerEvidence:{source:"KALSHI_MARKET_READ_ONLY",ticker:eventId,
      series:String(evidence.series_ticker??""),event:String(evidence.event_ticker??""),
      status:String(evidence.status),result:resultSide}
   }});
   return {id:row.id,payout,realized,duplicate:false};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(typeof settled==="string")return Response.json({error:settled},{status:409,headers:access.headers});
  return Response.json({settlement_id:settled.id,result:resultSide,duplicate:settled.duplicate,
   virtual_only:true,payout_usdc_micros:settled.payout.toString(),
   realized_virtual_pnl_usdc_micros:settled.realized.toString()},
   {status:settled.duplicate?200:201,headers:access.headers});
 }catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&["P2002","P2034"].includes(error.code))
   return Response.json({error:"Concurrent settlement; retry"},{status:409,headers:access.headers});
  return Response.json({error:"Unable to settle virtual position"},{status:503,headers:access.headers});
 }
}
