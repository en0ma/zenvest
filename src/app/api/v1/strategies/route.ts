import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {authorizeBotV1} from "@/lib/bot-v1-access";
import {strategyConfiguration} from "@/lib/bot-strategy-api-schema";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** A key is bound to the strategy already created in Bot Manager. */
export async function GET(request:Request){
 const access=await authorizeBotV1(request);
 if(!access.ok)return access.response;
 const s=await prisma.strategy.findUnique({where:{id:access.strategyId},
  select:{id:true,name:true,status:true,marketType:true,venue:true,eventSide:true,eventTag:true,isPublic:true,isActive:true}});
 if(!s)return Response.json({error:"Strategy not found"},{status:404,headers:access.headers});
 return Response.json({strategies:[{id:s.id,name:s.name,status:s.status,market_type:s.marketType==="PREDICTION"?"event":s.marketType.toLowerCase(),
  venue:s.venue,asset:s.eventTag,side:s.eventSide,is_public:s.isPublic,accepting_allocations:s.status==="TRADING"&&s.isActive&&s.isPublic}]},
  {headers:access.headers});
}
export async function POST(request:Request){
 const access=await authorizeBotV1(request);
 if(!access.ok)return access.response;
 let body:unknown;
 try{body=await request.json()}catch{return Response.json({error:"Invalid JSON"},{status:400,headers:access.headers})}
 const parsed=strategyConfiguration.safeParse(body);
 if(!parsed.success)return Response.json({error:"Only Kalshi event strategy configuration is supported in v1"},{status:400,headers:access.headers});
 try{
  const outcome=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${access.strategyId} FOR UPDATE`;
   const s=await tx.strategy.findUnique({where:{id:access.strategyId}});
   const key=await tx.botApiKey.findFirst({where:{id:access.keyId,revokedAt:null,bot:{ownerId:access.ownerId,strategyId:access.strategyId}}});
   if(!s||!key)return "UNAUTHORIZED";
   if(s.status!=="ONBOARDING"||s.isActive||s.isPublic)return "LOCKED";
   if(s.venue||s.eventTag||s.eventSide)return "ALREADY_CONFIGURED";
   await tx.strategy.update({where:{id:access.strategyId},data:{
    marketType:"PREDICTION",venue:"kalshi",eventTag:parsed.data.asset,eventSide:parsed.data.side
   }});
   return "CREATED";
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(outcome==="UNAUTHORIZED")return Response.json({error:"API key was revoked"},{status:401,headers:access.headers});
  if(outcome==="LOCKED")return Response.json({error:"Strategy configuration requires ONBOARDING"},{status:409,headers:access.headers});
  if(outcome==="ALREADY_CONFIGURED")return Response.json({error:"Strategy already configured"},{status:409,headers:access.headers});
  return Response.json({strategy_id:access.strategyId,status:"ONBOARDING",market_type:"event",venue:"kalshi",
   asset:parsed.data.asset,side:parsed.data.side},{status:201,headers:access.headers});
 }catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2034")
   return Response.json({error:"Concurrent strategy update; retry"},{status:409,headers:access.headers});
  return Response.json({error:"Unable to configure strategy"},{status:503,headers:access.headers});
 }
}
