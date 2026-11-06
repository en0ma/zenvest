import type {NextRequest} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {staffWriteError} from "@/lib/staff-write-error";
import {validateActionTarget} from "@/lib/staff-review-policy";
import {validateProposalPayload} from "@/lib/staff-financial-limits";
import {requireStaffPermission} from "@/lib/staff-access";
import type {StaffPermissionKey} from "@/lib/staff-permissions";
import {APPROVAL_POLICY_ID,canReviewAsRole} from "@/lib/staff-approval-policy";
const supported:Record<string,StaffPermissionKey>={"users:write":"users:write","wallets:operate":"wallets:operate"};
const proposal=z.object({resource:z.string(),operation:z.string(),targetId:z.string().min(1).max(128),reason:z.string().min(12).max(500),idempotencyKey:z.string().min(12).max(100),payload:z.unknown().optional()}).strict();
export async function POST(request:NextRequest){
 try{
 const parsed=proposal.safeParse(await request.json());
 if(!parsed.success)return Response.json({error:"Invalid request"},{status:400});
 const input=parsed.data;const permission=supported[input.resource+":"+input.operation];
 if(!permission||!validateActionTarget(input.resource,input.operation))return Response.json({error:"Unsupported operation"},{status:400});
 const actor=await requireStaffPermission(permission,{requireFreshLogin:true});
 const validated=validateProposalPayload(input.resource,input.operation,input.payload,process.env.STAFF_BALANCE_ADJUSTMENT_LIMIT_MICROS);
 if(!validated.ok)return Response.json({error:validated.reason},{status:422});
 const exists=await (async()=>{
  if(input.resource==="users")return Boolean(await prisma.user.findUnique({where:{id:input.targetId},select:{id:true}}));
  if(input.resource==="deposits")return Boolean(await prisma.blockchainDeposit.findUnique({where:{id:input.targetId},select:{id:true}}));
  if(input.resource==="withdrawals")return Boolean(await prisma.withdrawal.findUnique({where:{id:input.targetId},select:{id:true}}));
  if(input.resource==="wallets"){
   const payload=validated.payload;
   if(!("kind" in payload))return false;
   if(payload.kind==="MASTER_TO_WALLET")return Boolean(await prisma.treasury.findFirst({where:{id:input.targetId,kind:"DEPOSIT",source:"MASTER_WALLET"},select:{id:true}}));
   if(payload.kind==="KALSHI_TO_MASTER")return Boolean(await prisma.strategy.findFirst({where:{id:input.targetId,kalshiWalletAddress:{not:null}},select:{id:true}}));
   return false;
  }
  return false;
 })();
 if(!exists)return Response.json({error:"Target not found"},{status:404});
 const record=await prisma.$transaction(async tx=>{
 // A canonical Super Admin membership permits direct authorization without
 // seeking approval from a second account; execution is always a separate step.
 const superAdmin=await tx.userRole.findFirst({where:{userId:actor,role:{key:"super-admin"}},select:{userId:true}});
 const action=await tx.staffAction.create({data:{resource:input.resource,operation:input.operation,targetId:input.targetId,reason:input.reason,idempotencyKey:input.idempotencyKey,requestedBy:actor,payload:validated.payload,
  ...(superAdmin?{status:"APPROVED" as const,decidedBy:actor,decidedAt:new Date()}:{})}});
 await tx.staffAudit.create({data:{actorId:actor,action:superAdmin?"super-admin.self-approved":"proposed",resource:input.resource,targetId:input.targetId}});
 return action;
 });
 return Response.json({id:record.id,status:record.status,execution:"NOT_EXECUTED",approvalMode:record.decidedBy===actor?"SUPER_ADMIN_SELF_APPROVED":"REVIEW_REQUIRED"},{status:201});
 }catch(error){
 if(error&&typeof error==="object"&&"code" in error&&error.code==="P2002")return Response.json({error:"Duplicate idempotency key"},{status:409});
 return staffWriteError(error);
 }
}


export async function GET(){
 try{
  const actor=await requireStaffPermission("account:access");
  const [memberships,policy]=await Promise.all([
   prisma.userRole.findMany({where:{userId:actor},select:{role:{select:{key:true,grants:{select:{permission:{select:{key:true}}}}}}}}),
   prisma.staffApprovalPolicy.findUnique({where:{id:APPROVAL_POLICY_ID},select:{additionalRoleKeys:true}})
  ]);
  const audit=memberships.some(m=>m.role.grants.some(g=>g.permission.key==="audit:read"));
  if(!audit&&!canReviewAsRole(memberships.map(m=>m.role.key),policy?.additionalRoleKeys??[]))
   return Response.json({error:"Access denied"},{status:403});
  const data=await prisma.staffAction.findMany({take:50,orderBy:{createdAt:"desc"},select:{id:true,resource:true,operation:true,targetId:true,reason:true,requestedBy:true,decidedBy:true,status:true,createdAt:true,decidedAt:true}});
  return Response.json({data},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return Response.json({error:"Access denied"},{status:403});
 }
}
