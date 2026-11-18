import type {NextRequest} from "next/server";
import {z} from "zod";
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
/**
 * Assigns only restricted staff roles. Super Admin must be provisioned
 * outside the public API by a controlled administrative process.
 */
export async function POST(request:NextRequest){
 try{
  const actorId=await requireStaffPermission("roles:manage",{requireFreshLogin:true});
  const parsed=membershipInput.safeParse(await request.json());
  if(!parsed.success)return Response.json({error:"Invalid role assignment"},{status:400});
  const {roleKey}=parsed.data;
  if(roleKey!=="bot"&&!isEditableRoleKey(roleKey))return Response.json({error:"Protected or invalid role"},{status:400});
  if(parsed.data.userId===actorId)return Response.json({error:"Self-assignment prohibited"},{status:403});
  const result=await prisma.$transaction(async tx=>{
   if(!await tx.userRole.findFirst({where:{userId:actorId,role:{key:"super-admin"}},select:{userId:true}}))return "FORBIDDEN";
   const target=await tx.user.findUnique({where:roleKey==="bot"?{handle:parsed.data.handle!}:{id:parsed.data.userId!},select:{id:true,isActive:true,emailVerifiedAt:true}});
   if(!target)return "NOT_FOUND";
   const userId=target.id;
   if(userId===actorId)return "SELF";
   const factor=await tx.twoFactor.findUnique({where:{userId},select:{verifiedAt:true}});
   if(!target?.isActive||!target.emailVerifiedAt||!factor?.verifiedAt)return "INELIGIBLE";
   const role=await tx.role.findUnique({where:{key:roleKey}});
   if(!role)return "UNKNOWN_ROLE";
   const existing=await tx.userRole.findUnique({where:{userId_roleId:{userId,roleId:role.id}}});
   if(existing)return "EXISTS";
   await tx.userRole.create({data:{userId,roleId:role.id,assignedBy:actorId}});
   await tx.staffAudit.create({data:{actorId,action:"role.assigned:"+roleKey,resource:"roles",targetId:userId}});
   if(roleKey==="bot")await tx.botManagerNotice.create({data:{userId,kind:"APPROVED"}});
   return "CREATED";
  });
  if(result==="NOT_FOUND")return Response.json({error:"User handle not found"},{status:404});
  if(result==="SELF")return Response.json({error:"Self-assignment prohibited"},{status:403});
  if(result==="FORBIDDEN")return Response.json({error:"Super Admin required"},{status:403});
  if(result==="INELIGIBLE")return Response.json({error:"Target must be active, verified and enrolled in 2FA"},{status:422});
  if(result==="UNKNOWN_ROLE")return Response.json({error:"Role is not provisioned"},{status:409});
  if(result==="EXISTS")return Response.json({error:"Role is already assigned"},{status:409});
  return Response.json({status:"ASSIGNED"},{status:201});
 }catch(error){
  if(error&&typeof error==="object"&&"code" in error&&error.code==="P2002")return Response.json({error:"Role already assigned"},{status:409});
  return staffWriteError(error);
 }
}
