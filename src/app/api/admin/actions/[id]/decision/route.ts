import type {NextRequest} from "next/server";
import {Prisma} from "@prisma/client";
import {canReviewAsRole,APPROVAL_POLICY_ID} from "@/lib/staff-approval-policy";
import {prisma} from "@/lib/db";
import {staffWriteError} from "@/lib/staff-write-error";
import {z} from "zod";
import {canReviewAction} from "@/lib/staff-review-policy";
import {validateProposalPayload} from "@/lib/staff-financial-limits";
import {requireStaffPermission} from "@/lib/staff-access";
const decisionSchema=z.object({approve:z.boolean()}).strict();
const supported=new Set(["users:write","wallets:operate"]);
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
 const {id}=await params;const parsed=decisionSchema.safeParse(await request.json());
 if(!parsed.success)return Response.json({error:"Invalid decision"},{status:400});
 const action=await prisma.staffAction.findUnique({where:{id}});
 if(!action)return Response.json({error:"Not found"},{status:404});
 if(!supported.has(action.resource+":"+action.operation))return Response.json({error:"Unsupported operation"},{status:400});
 // Baseline access authenticates and verifies 2FA; reviewer eligibility is
 // independent of the permission needed to propose/execute the operation.
 const actor=await requireStaffPermission("account:access",{requireFreshLogin:true});
 const payloadCheck=validateProposalPayload(action.resource,action.operation,action.payload,process.env.STAFF_BALANCE_ADJUSTMENT_LIMIT_MICROS);
 if(!payloadCheck.ok)return Response.json({error:"Action parameters violate current financial policy",code:payloadCheck.reason},{status:422});
 // Restrict status and age early; role-dependent self-approval is checked
 // again against live database roles inside the transaction.
 if(action.status!=="PENDING"||!canReviewAction({status:action.status,requestedBy:action.requestedBy,actorId:actor,hasPermission:true,isTwoFactorVerified:true,isSuperAdmin:true,createdAt:action.createdAt}))return Response.json({error:"Approval policy denied"},{status:403});
 const state=parsed.data.approve?"APPROVED":"REJECTED";
 const cutoff=new Date(Date.now()-24*60*60*1000);
 const outcome=await prisma.$transaction(async tx=>{
 const policy=await tx.staffApprovalPolicy.findUnique({where:{id:APPROVAL_POLICY_ID},select:{additionalRoleKeys:true}});
 // If configuration is absent or corrupted, fall back to Super Admin only.
 const roles=await tx.userRole.findMany({where:{userId:actor},select:{role:{select:{key:true}}}});
 const roleKeys=roles.map(item=>item.role.key);
 if(!canReviewAsRole(roleKeys,policy?.additionalRoleKeys??[]))return "FORBIDDEN";
 const isSuperAdmin=roleKeys.includes("super-admin");
 if(!canReviewAction({status:action.status,requestedBy:action.requestedBy,actorId:actor,hasPermission:true,isTwoFactorVerified:true,isSuperAdmin,createdAt:action.createdAt}))return "FORBIDDEN";
 const result=await tx.staffAction.updateMany({where:{id,status:"PENDING",createdAt:{gte:cutoff,lte:new Date()},...(isSuperAdmin?{}:{requestedBy:{not:actor}})},data:{status:state,decidedBy:actor,decidedAt:new Date()}});
 if(result.count!==1)return "CONFLICT";
 await tx.staffAudit.create({data:{actorId:actor,action:isSuperAdmin&&action.requestedBy===actor?"super-admin.self-"+state.toLowerCase():state,resource:action.resource,targetId:action.targetId}});
 return "DECIDED";
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 if(outcome==="FORBIDDEN")return Response.json({error:"Super Admin or an authorized reviewer role is required"},{status:403});
 return outcome==="DECIDED"?Response.json({status:state,execution:"NOT_EXECUTED"}):Response.json({error:"Already decided"},{status:409});
 }catch(error){return staffWriteError(error)}
}
