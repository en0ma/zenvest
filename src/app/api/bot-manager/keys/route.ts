import {Prisma} from "@prisma/client";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {currentBotManager} from "@/lib/bot-manager-access";
import {generateBotKey} from "@/lib/bot-manager-policy";
export const dynamic="force-dynamic";
const schema=z.object({label:z.string().trim().min(1).max(100)}).strict();
export async function GET(){
 const ownerId=await currentBotManager();
 if(!ownerId)return Response.json({error:"Bot role required"},{status:403});
 const keys=await prisma.botApiKey.findMany({where:{ownerId},orderBy:{createdAt:"desc"},
  select:{id:true,label:true,keyPrefix:true,revokedAt:true,createdAt:true,lastUsedAt:true}});
 return Response.json({keys},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request){
 const ownerId=await currentBotManager();
 if(!ownerId)return Response.json({error:"Bot role required"},{status:403});
 let body:unknown;
 try{body=await request.json()}catch{return Response.json({error:"Invalid JSON"},{status:400})}
 const parsed=schema.safeParse(body);
 if(!parsed.success)return Response.json({error:"Invalid key label"},{status:400});
 try{
  const secret=generateBotKey();
  const result=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${ownerId} FOR UPDATE`;
   const member=await tx.userRole.findFirst({where:{userId:ownerId,role:{key:"bot"}}});
   if(!member)return "FORBIDDEN";
   if(await tx.botApiKey.count({where:{ownerId,revokedAt:null}})>=5)return "LIMIT";
   return tx.botApiKey.create({data:{ownerId,label:parsed.data.label,keyHash:secret.hash,keyPrefix:secret.prefix}});
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(typeof result==="string")return Response.json({error:result},{status:409});
  return Response.json({id:result.id,apiKey:secret.raw,prefix:secret.prefix},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2034")
   return Response.json({error:"Concurrent key update; retry"},{status:409});
  return Response.json({error:"Unable to issue key"},{status:503});
 }
}
