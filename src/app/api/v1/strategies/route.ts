import {Prisma} from "@prisma/client";
import {randomUUID} from "node:crypto";
import {prisma} from "@/lib/db";
import {authorizeBotV1} from "@/lib/bot-v1-access";
import {allocationMicros,strategyConfiguration} from "@/lib/bot-strategy-api-schema";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** One manager API key lists ALL owned strategies. */
export async function GET(request:Request){
 const access=await authorizeBotV1(request);
 if(!access.ok)return access.response;
 const bots=await prisma.bot.findMany({where:{ownerId:access.ownerId},orderBy:{createdAt:"desc"},
  include:{strategy:{select:{id:true,name:true,status:true,marketType:true,venue:true,eventTag:true,
   minAllocationUsdcMicros:true,maxAllocationUsdcMicros:true,isPublic:true,isActive:true}}}});
 return Response.json({strategies:bots.map(({strategy:s})=>({
  id:s.id,name:s.name,status:s.status,market_type:s.marketType==="PREDICTION"?"event":s.marketType.toLowerCase(),
  venue:s.venue,asset:s.eventTag,min_allocation_usdc_micros:s.minAllocationUsdcMicros.toString(),
  max_allocation_usdc_micros:s.maxAllocationUsdcMicros.toString(),
  is_public:s.isPublic,accepting_allocations:s.status==="TRADING"&&s.isActive&&s.isPublic
 }))},{headers:access.headers});
}
/** Creates a fresh bot and ONBOARDING strategy unless strategy_id targets the
 * manager's existing unconfigured ONBOARDING bot strategy. */
export async function POST(request:Request){
 const access=await authorizeBotV1(request);
 if(!access.ok)return access.response;
 let body:unknown;
 try{body=await request.json()}catch{return Response.json({error:"Invalid JSON"},{status:400,headers:access.headers})}
 const parsed=strategyConfiguration.safeParse(body);
 if(!parsed.success)return Response.json({error:"Invalid Kalshi event strategy or allocation limits"},{status:400,headers:access.headers});
 const data=parsed.data,min=allocationMicros(data.min_allocation)!,max=allocationMicros(data.max_allocation)!;
 try{
  const result=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${access.ownerId} FOR UPDATE`;
   const key=await tx.botApiKey.findFirst({where:{id:access.keyId,ownerId:access.ownerId,revokedAt:null}});
   const member=await tx.userRole.findFirst({where:{userId:access.ownerId,role:{key:"bot"}}});
   if(!key||!member)return "UNAUTHORIZED";
   if(data.strategy_id){
    const bot=await tx.bot.findFirst({where:{ownerId:access.ownerId,strategyId:data.strategy_id},select:{id:true}});
    if(!bot)return "NOT_OWNED";
    await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${data.strategy_id} FOR UPDATE`;
    const s=await tx.strategy.findUniqueOrThrow({where:{id:data.strategy_id}});
    if(s.status!=="ONBOARDING"||s.isActive||s.isPublic||s.venue||s.eventTag)return "LOCKED";
    await tx.strategy.update({where:{id:s.id},data:{
     marketType:"PREDICTION",venue:"kalshi",eventTag:data.asset,
     minAllocationUsdcMicros:min,maxAllocationUsdcMicros:max
    }});
    return {id:s.id};
   }
   if(await tx.bot.count({where:{ownerId:access.ownerId}})>=100)return "LIMIT";
   const id=randomUUID(),label=data.asset.slice(0,100);
   const strategy=await tx.strategy.create({data:{
    id,name:label+" · "+id.slice(0,8),description:"Kalshi event strategy for "+data.asset,
    status:"ONBOARDING",isActive:false,isPublic:false,marketType:"PREDICTION",
    venue:"kalshi",eventTag:data.asset,minAllocationUsdcMicros:min,maxAllocationUsdcMicros:max
   }});
   await tx.bot.create({data:{ownerId:access.ownerId,strategyId:id,name:label,description:strategy.description}});
   return {id};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(result==="UNAUTHORIZED")return Response.json({error:"API key revoked or role removed"},{status:401,headers:access.headers});
  if(result==="NOT_OWNED")return Response.json({error:"Strategy not owned by manager"},{status:403,headers:access.headers});
  if(result==="LOCKED")return Response.json({error:"Only an unconfigured ONBOARDING strategy can be configured"},{status:409,headers:access.headers});
  if(result==="LIMIT")return Response.json({error:"Manager strategy limit reached"},{status:409,headers:access.headers});
  return Response.json({strategy_id:result.id,status:"ONBOARDING",market_type:"event",venue:"kalshi",
   asset:data.asset,min_allocation:data.min_allocation,max_allocation:data.max_allocation},{status:201,headers:access.headers});
 }catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&["P2034","P2002"].includes(error.code))
   return Response.json({error:"Concurrent strategy creation; retry"},{status:409,headers:access.headers});
  return Response.json({error:"Unable to create strategy"},{status:503,headers:access.headers});
 }
}
