import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {authorizeBotV1} from "@/lib/bot-v1-access";
import {canRecordBotTrade,canonicalEventSide,eventTradeInput} from "@/lib/bot-strategy-api-schema";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{strategyId:string}>};
/** Request intake only. It never executes on Kalshi, settles P&L or moves funds. */
export async function POST(request:Request,{params}:Context){
 const {strategyId}=await params;
 const access=await authorizeBotV1(request,strategyId);
 if(!access.ok)return access.response;
 const idempotency=request.headers.get("idempotency-key");
 if(!idempotency||!/^[A-Za-z0-9_-]{8,100}$/.test(idempotency))
  return Response.json({error:"Idempotency-Key header (8-100 safe characters) required"},{status:400,headers:access.headers});
 let body:unknown;
 try{body=await request.json()}catch{return Response.json({error:"Invalid JSON"},{status:400,headers:access.headers})}
 const parsed=eventTradeInput.safeParse(body);
 if(!parsed.success)return Response.json({error:"Invalid Kalshi event trade payload"},{status:400,headers:access.headers});
 const side=canonicalEventSide(parsed.data.side);
 try{
  const result=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${strategyId} FOR UPDATE`;
   const bot=await tx.bot.findFirst({where:{ownerId:access.ownerId,strategyId},select:{id:true}});
   const key=await tx.botApiKey.findFirst({where:{id:access.keyId,ownerId:access.ownerId,revokedAt:null}});
   if(!bot||!key)return "UNAUTHORIZED";
   const s=await tx.strategy.findUnique({where:{id:strategyId},select:{
    status:true,marketType:true,venue:true,eventTag:true
   }});
   if(!s||!canRecordBotTrade(s.status,s.marketType,s.venue,s.eventTag))return "NOT_AVAILABLE";
   const prev=await tx.botTradeIntent.findUnique({where:{strategyId_idempotencyKey:{strategyId,idempotencyKey:idempotency}}});
   if(prev){
    if(prev.orderType!==parsed.data.order_type||prev.tradeSize!==parsed.data.trade_size||
       prev.eventId!==parsed.data.event_id||prev.side!==side)return "IDEMPOTENCY_CONFLICT";
    return {id:prev.id,status:prev.status,duplicate:true};
   }
   const intent=await tx.botTradeIntent.create({data:{
    botId:bot.id,strategyId,keyId:access.keyId,idempotencyKey:idempotency,
    orderType:parsed.data.order_type,tradeSize:parsed.data.trade_size,
    eventId:parsed.data.event_id,side
   }});
   return {id:intent.id,status:intent.status,duplicate:false};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(result==="UNAUTHORIZED")return Response.json({error:"API key revoked or strategy not owned"},{status:401,headers:access.headers});
  if(result==="NOT_AVAILABLE")return Response.json({error:"Strategy cannot accept trade intents in its current state"},{status:409,headers:access.headers});
  if(result==="IDEMPOTENCY_CONFLICT")return Response.json({error:"Idempotency key reused with different trade details"},{status:409,headers:access.headers});
  return Response.json({intent_id:result.id,status:result.status,executed:false,duplicate:result.duplicate,canonical_side:side},
   {status:202,headers:access.headers});
 }catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&["P2034","P2002"].includes(error.code))
   return Response.json({error:"Concurrent intent; retry with same Idempotency-Key"},{status:409,headers:access.headers});
  return Response.json({error:"Unable to record unexecuted trade intent"},{status:503,headers:access.headers});
 }
}
