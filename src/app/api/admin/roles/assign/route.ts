import type {NextRequest} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {staffWriteError} from "@/lib/staff-write-error";
import {requireStaffPermission} from "@/lib/staff-access";
import {isEditableRoleKey,ROLE_KEY_PATTERN} from "@/lib/staff-role-editor-policy";
export const dynamic="force-dynamic";
const assignment=z.object({userId:z.string().min(1).max(100),roleKey:z.string().regex(ROLE_KEY_PATTERN)}).strict();
/**
 * Assigns only restricted staff roles. Super Admin must be provisioned
 * outside the public API by a controlled administrative process.
 */
export async function POST(request:NextRequest){
 try{
  const actorId=await requireStaffPermission("roles:manage",{requireFreshLogin:true});
  const parsed=assignment.safeParse(await request.json());
  if(!parsed.success)return Response.json({error:"Invalid role assignment"},{status:400});
  const {userId,roleKey}=parsed.data;
  if(!isEditableRoleKey(roleKey))return Response.json({error:"Protected or invalid role"},{status:400});
  if(userId===actorId)return Response.json({error:"Self-assignment prohibited"},{status:403});
  const result=await prisma.$transaction(async tx=>{
   if(!await tx.userRole.findFirst({where:{userId:actorId,role:{key:"super-admin"}},select:{userId:true}}))return "FORBIDDEN";
   const target=await tx.user.findUnique({where:{id:userId},select:{isActive:true,emailVerifiedAt:true}});
   if(!target?.isActive||!target.emailVerifiedAt)return "INELIGIBLE";
   const role=await tx.role.findUnique({where:{key:roleKey}});
   if(!role)return "UNKNOWN_ROLE";
   const existing=await tx.userRole.findUnique({where:{userId_roleId:{userId,roleId:role.id}}});
   if(existing)return "EXISTS";
   await tx.userRole.create({data:{userId,roleId:role.id,assignedBy:actorId}});
   // Invalidate any existing investor session before staff membership takes effect.
   await tx.user.update({where:{id:userId},data:{sessionVersion:{increment:1}}});
   await tx.staffAudit.create({data:{actorId,action:"role.assigned:"+roleKey,resource:"roles",targetId:userId}});
   return "CREATED";
  });
  if(result==="FORBIDDEN")return Response.json({error:"Super Admin required"},{status:403});
  if(result==="INELIGIBLE")return Response.json({error:"Target must be active and email-verified"},{status:422});
  if(result==="UNKNOWN_ROLE")return Response.json({error:"Role is not provisioned"},{status:409});
  if(result==="EXISTS")return Response.json({error:"Role is already assigned"},{status:409});
  return Response.json({status:"ASSIGNED"},{status:201});
 }catch(error){
  if(error&&typeof error==="object"&&"code" in error&&error.code==="P2002")return Response.json({error:"Role already assigned"},{status:409});
  return staffWriteError(error);
 }
}
