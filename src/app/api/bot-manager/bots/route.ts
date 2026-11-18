import {Prisma} from "@prisma/client";
import {z} from "zod";
import {randomUUID,randomBytes} from "node:crypto";
import {prisma} from "@/lib/db";
import {currentBotManager} from "@/lib/bot-manager-access";
import {allocationMicros} from "@/lib/bot-strategy-api-schema";
export const dynamic="force-dynamic";
const create=z.object({
 name:z.string().trim().min(3).max(100),
 description:z.string().trim().max(500).default(""),
 market_type:z.literal("event"),venue:z.literal("kalshi"),
 asset:z.string().trim().min(2).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
 min_allocation:z.string(),max_allocation:z.string()
}).strict().refine(x=>{
 const min=allocationMicros(x.min_allocation),max=allocationMicros(x.max_allocation);
 return min!==null&&max!==null&&min<=max;
});
export async function GET(){
 const ownerId=await currentBotManager();
 if(!ownerId)return Response.json({error:"Bot role required"},{status:403});
 const bots=await prisma.bot.findMany({where:{ownerId},orderBy:{createdAt:"desc"},include:{
  strategy:{select:{id:true,publicKey:true,status:true,isActive:true,isPublic:true}}
 }});
 return Response.json({bots},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request){
 const ownerId=await currentBotManager();
 if(!ownerId)return Response.json({error:"Bot role required"},{status:403});
 let body:unknown;
 try{body=await request.json()}catch{return Response.json({error:"Invalid JSON"},{status:400})}
 const parsed=create.safeParse(body);
 if(!parsed.success)return Response.json({error:"Invalid bot details"},{status:400});
 try{
  const bot=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${ownerId} FOR UPDATE`;
   const membership=await tx.userRole.findFirst({where:{userId:ownerId,role:{key:"bot"}}});
   if(!membership)throw Error("ROLE_REVOKED");
   const count=await tx.bot.count({where:{ownerId}});
   if(count>=100)throw Error("BOT_LIMIT");
   const id=randomUUID();
   const strategy=await tx.strategy.create({data:{
    id,publicKey:"zvs_"+randomBytes(20).toString("hex"),name:parsed.data.name+" · "+id.slice(0,8),description:parsed.data.description,
    status:"ONBOARDING",isActive:false,isPublic:false,
    marketType:"PREDICTION",venue:"kalshi",eventTag:parsed.data.asset,
    minAllocationUsdcMicros:allocationMicros(parsed.data.min_allocation)!,
    maxAllocationUsdcMicros:allocationMicros(parsed.data.max_allocation)!
   }});
   return tx.bot.create({data:{ownerId,strategyId:strategy.id,name:parsed.data.name,description:parsed.data.description},include:{strategy:{select:{publicKey:true}}}});
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  return Response.json({bot:{id:bot.id,name:bot.name,strategyId:bot.strategyId,strategyPubkey:bot.strategy.publicKey,status:"ONBOARDING"}},{status:201});
 }catch(error){
  if(error instanceof Error&&["ROLE_REVOKED","BOT_LIMIT"].includes(error.message))
   return Response.json({error:error.message},{status:409});
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2034")
   return Response.json({error:"Concurrent update; retry"},{status:409});
  return Response.json({error:"Unable to create bot"},{status:503});
 }
}
