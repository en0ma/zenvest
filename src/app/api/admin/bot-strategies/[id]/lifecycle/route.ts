import {Prisma} from "@prisma/client";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {requireStaffPermission} from "@/lib/staff-access";
import {staffWriteError} from "@/lib/staff-write-error";
import {canPromoteStrategy} from "@/lib/bot-manager-policy";
export const dynamic="force-dynamic";
const bodySchema=z.object({status:z.enum(["MONITORING","TRADING","SHUTTING_DOWN"])}).strict();
type Context={params:Promise<{id:string}>};
/** No direct SHUTDOWN override. Finalization only follows verified return. */
export async function POST(request:Request,{params}:Context){
 try{
  const actor=await requireStaffPermission("roles:manage",{requireFreshLogin:true});
  const {id}=await params;
  let body:unknown;
  try{body=await request.json()}catch{return Response.json({error:"Invalid JSON"},{status:400})}
  const parsed=bodySchema.safeParse(body);
  if(!parsed.success)return Response.json({error:"Unsupported transition"},{status:400});
  const next=parsed.data.status;
  const result=await prisma.$transaction(async tx=>{
   const superAdmin=await tx.userRole.findFirst({where:{userId:actor,role:{key:"super-admin"}},select:{userId:true}});
   if(!superAdmin)return "FORBIDDEN";
   const bot=await tx.bot.findFirst({where:{strategyId:id},select:{ownerId:true}});
   if(!bot)return "NOT_FOUND";
   await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${bot.ownerId} FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${id} FOR UPDATE`;
   const s=await tx.strategy.findUniqueOrThrow({where:{id}});
   if(next==="SHUTTING_DOWN"){
    if(s.status!=="TRADING"&&s.status!=="MONITORING"&&s.status!=="ONBOARDING")return "CONFLICT";
    await tx.strategy.update({where:{id},data:{status:"SHUTTING_DOWN",isActive:false,isPublic:false}});
    // Existing positions close through a verified pooled strategy return, not
    // individual external Kalshi withdrawals.
    await tx.investorPosition.updateMany({where:{strategyId:id,status:"OPEN"},data:{status:"CLOSING",lastPnlUpdated:false}});
   }else{
    if(!canPromoteStrategy(s.status,next))return "CONFLICT";
    if(next==="TRADING"&&(!s.kalshiWalletAddress||!s.blockRadarAddress))return "MISSING_WALLETS";
    await tx.strategy.update({where:{id},data:{
     status:next,isActive:next==="TRADING",isPublic:true
    }});
   }
   await tx.staffAudit.create({data:{actorId:actor,action:"bot.strategy.lifecycle:"+next,resource:"strategies",targetId:id}});
   return "OK";
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(result==="FORBIDDEN")return Response.json({error:"Super Admin required"},{status:403});
  if(result==="NOT_FOUND")return Response.json({error:"Not a bot-owned strategy"},{status:404});
  if(result==="MISSING_WALLETS")return Response.json({error:"Configured Kalshi and Blockradar wallets are required"},{status:409});
  if(result==="CONFLICT")return Response.json({error:"Invalid current strategy state"},{status:409});
  return Response.json({status:next},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return staffWriteError(error)}
}
