import type {NextRequest} from "next/server";
import {z} from "zod";
import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {staffWriteError} from "@/lib/staff-write-error";
import {requireStaffPermission} from "@/lib/staff-access";
import {isEditableRoleKey,ROLE_KEY_PATTERN} from "@/lib/staff-role-editor-policy";
export const dynamic="force-dynamic";
const handlePattern=/^[a-z0-9]{1,8}$/;
const membershipInput=z.object({roleKey:z.string().regex(ROLE_KEY_PATTERN),userId:z.string().min(1).max(100).optional(),handle:z.string().regex(handlePattern).optional()}).strict().superRefine((data,ctx)=>{
 if(data.roleKey==="bot" ? (!data.handle||data.userId!==undefined) : (!data.userId||data.handle!==undefined))
  ctx.addIssue({code:z.ZodIssueCode.custom,message:"Bot manager membership requires an exact user handle; staff roles require user ID"});
});
export async function POST(request:NextRequest){
 try{
  const actor=await requireStaffPermission("roles:manage",{requireFreshLogin:true});
  const parsed=membershipInput.safeParse(await request.json());
  if(!parsed.success)return Response.json({error:"Invalid revocation request"},{status:400});
  const {roleKey}=parsed.data;
  if(roleKey!=="bot"&&!isEditableRoleKey(roleKey))return Response.json({error:"Protected or invalid role"},{status:400});
  if(parsed.data.userId===actor)return Response.json({error:"Self-revocation requires independent authorization"},{status:403});
  const outcome=await prisma.$transaction(async tx=>{
   if(!await tx.userRole.findFirst({where:{userId:actor,role:{key:"super-admin"}},select:{userId:true}}))return "FORBIDDEN";
   const target=await tx.user.findUnique({where:roleKey==="bot"?{handle:parsed.data.handle!}:{id:parsed.data.userId!},select:{id:true}});
   if(!target)return "NOT_FOUND";
   const userId=target.id;
   if(userId===actor)return "SELF";
   const role=await tx.role.findUnique({where:{key:roleKey},select:{id:true}});
   if(!role)return "NOT_FOUND";
   if(roleKey==="bot"){
    await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
    const open=await tx.bot.count({where:{ownerId:userId,strategy:{status:{not:"SHUTDOWN"}}}});
    if(open)return "ACTIVE_STRATEGIES";
    await tx.botApiKey.updateMany({where:{ownerId:userId,revokedAt:null},data:{revokedAt:new Date()}});
   }
   const removed=await tx.userRole.deleteMany({where:{userId,roleId:role.id}});
   if(removed.count===0)return "NOT_FOUND";
   await tx.user.update({where:{id:userId},data:{sessionVersion:{increment:1}}});
   await tx.staffAudit.create({data:{actorId:actor,action:"role.revoked:"+roleKey,resource:"roles",targetId:userId}});
   return "REVOKED";
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(outcome==="ACTIVE_STRATEGIES")return Response.json({error:"All bot strategies must be SHUTDOWN before revoking bot role"},{status:409});
  if(outcome==="SELF")return Response.json({error:"Self-revocation requires independent authorization"},{status:403});
  if(outcome==="FORBIDDEN")return Response.json({error:"Super Admin required"},{status:403});
  if(outcome==="NOT_FOUND")return Response.json({error:"Role membership not found"},{status:404});
  return Response.json({status:"REVOKED"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return staffWriteError(error)}
}
