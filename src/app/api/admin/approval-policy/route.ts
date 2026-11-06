import type {NextRequest} from "next/server";
import {Prisma} from "@prisma/client";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {requireStaffPermission} from "@/lib/staff-access";
import {staffWriteError} from "@/lib/staff-write-error";
import {APPROVAL_POLICY_ID,CONFIGURABLE_APPROVER_ROLES} from "@/lib/staff-approval-policy";
export const dynamic="force-dynamic";
const body=z.object({
 additionalRoleKeys:z.array(z.enum(CONFIGURABLE_APPROVER_ROLES)).max(CONFIGURABLE_APPROVER_ROLES.length)
}).strict();
/** Only actual Super Admin memberships can manage approval eligibility. */
export async function GET(){
 try{
  const actor=await requireStaffPermission("roles:manage");
  const role=await prisma.userRole.findFirst({where:{userId:actor,role:{key:"super-admin"}},select:{userId:true}});
  if(!role)return Response.json({error:"Super Admin required"},{status:403});
  const policy=await prisma.staffApprovalPolicy.findUnique({where:{id:APPROVAL_POLICY_ID},select:{additionalRoleKeys:true}});
  return Response.json({additionalRoleKeys:policy?.additionalRoleKeys??[],superAdminAlwaysEligible:true},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return staffWriteError(error)}
}
export async function PUT(request:NextRequest){
 try{
  const actor=await requireStaffPermission("roles:manage",{requireFreshLogin:true});
  const parsed=body.safeParse(await request.json());
  if(!parsed.success||new Set(parsed.data.additionalRoleKeys).size!==parsed.data.additionalRoleKeys.length)
   return Response.json({error:"Invalid reviewer-role selection"},{status:400});
  const enabled=parsed.data.additionalRoleKeys.slice().sort();
  const result=await prisma.$transaction(async tx=>{
   const isSuperAdmin=await tx.userRole.findFirst({where:{userId:actor,role:{key:"super-admin"}},select:{userId:true}});
   if(!isSuperAdmin)return false;
   await tx.staffApprovalPolicy.upsert({where:{id:APPROVAL_POLICY_ID},create:{id:APPROVAL_POLICY_ID,additionalRoleKeys:enabled},update:{additionalRoleKeys:enabled}});
   await tx.staffAudit.create({data:{actorId:actor,action:"approval.policy.updated",resource:"roles",targetId:APPROVAL_POLICY_ID}});
   return true;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(!result)return Response.json({error:"Super Admin required"},{status:403});
  return Response.json({additionalRoleKeys:enabled,superAdminAlwaysEligible:true},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return staffWriteError(error)}
}
