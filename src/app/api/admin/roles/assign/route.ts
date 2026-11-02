import type {NextRequest} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {requireStaffPermission} from "@/lib/staff-access";
export const dynamic="force-dynamic";
const assignment=z.object({userId:z.string().min(1).max(100),roleKey:z.enum(["operations","finance","support","auditor"])}).strict();
/**
 * Assigns only restricted staff roles. Super Admin must be provisioned
 * outside the public API by a controlled administrative process.
 */
export async function POST(request:NextRequest){
 try{
  const actorId=await requireStaffPermission("roles:manage");
  const parsed=assignment.safeParse(await request.json());
  if(!parsed.success)return Response.json({error:"Invalid role assignment"},{status:400});
  const {userId,roleKey}=parsed.data;
  if(userId===actorId)return Response.json({error:"Self-assignment prohibited"},{status:403});
  const result=await prisma.$transaction(async tx=>{
   const target=await tx.user.findUnique({where:{id:userId},select:{isActive:true,emailVerifiedAt:true}});
   const factor=await tx.twoFactor.findUnique({where:{userId},select:{verifiedAt:true}});
   if(!target?.isActive||!target.emailVerifiedAt||!factor?.verifiedAt)return "INELIGIBLE";
   const role=await tx.staffRole.findUnique({where:{key:roleKey}});
   if(!role)return "UNKNOWN_ROLE";
   const existing=await tx.staffRoleMembership.findUnique({where:{userId_roleId:{userId,roleId:role.id}}});
   if(existing)return "EXISTS";
   await tx.staffRoleMembership.create({data:{userId,roleId:role.id,assignedBy:actorId}});
   await tx.staffAudit.create({data:{actorId,action:"role.assigned:"+roleKey,resource:"roles",targetId:userId}});
   return "CREATED";
  });
  if(result==="INELIGIBLE")return Response.json({error:"Target must be active, verified and enrolled in 2FA"},{status:422});
  if(result==="UNKNOWN_ROLE")return Response.json({error:"Role is not provisioned"},{status:409});
  if(result==="EXISTS")return Response.json({error:"Role is already assigned"},{status:409});
  return Response.json({status:"ASSIGNED"},{status:201});
 }catch(error){
  if(error&&typeof error==="object"&&"code" in error&&error.code==="P2002")return Response.json({error:"Role already assigned"},{status:409});
  return Response.json({error:"Access denied or assignment unavailable"},{status:403});
 }
}
