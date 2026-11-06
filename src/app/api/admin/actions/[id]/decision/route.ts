import type {NextRequest} from "next/server";
import {prisma} from "@/lib/db";
import {staffWriteError} from "@/lib/staff-write-error";
import {z} from "zod";
import {canReviewAction} from "@/lib/staff-review-policy";
import {validateProposalPayload} from "@/lib/staff-financial-limits";
import {requireStaffPermission} from "@/lib/staff-access";
import type {StaffPermissionKey} from "@/lib/staff-permissions";
const decisionSchema=z.object({approve:z.boolean()}).strict();
const supported:Record<string,StaffPermissionKey>={"users:write":"users:write","wallets:operate":"wallets:operate"};
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
 const {id}=await params;const parsed=decisionSchema.safeParse(await request.json());
 if(!parsed.success)return Response.json({error:"Invalid decision"},{status:400});
 const action=await prisma.staffAction.findUnique({where:{id}});
 if(!action)return Response.json({error:"Not found"},{status:404});
 const permission=supported[action.resource+":"+action.operation];
 if(!permission)return Response.json({error:"Unsupported operation"},{status:400});
 const actor=await requireStaffPermission(permission,{requireFreshLogin:true});
 const payloadCheck=validateProposalPayload(action.resource,action.operation,action.payload,process.env.STAFF_BALANCE_ADJUSTMENT_LIMIT_MICROS,process.env.STAFF_WALLET_TRANSFER_LIMIT_MICROS);
 if(!payloadCheck.ok)return Response.json({error:"Action parameters violate current financial policy",code:payloadCheck.reason},{status:422});
 if(!canReviewAction({status:action.status,requestedBy:action.requestedBy,actorId:actor,hasPermission:true,isTwoFactorVerified:true,createdAt:action.createdAt}))return Response.json({error:"Approval policy denied"},{status:403});
 const state=parsed.data.approve?"APPROVED":"REJECTED";
 const cutoff=new Date(Date.now()-24*60*60*1000);
 const changed=await prisma.$transaction(async tx=>{
 const result=await tx.staffAction.updateMany({where:{id,status:"PENDING",createdAt:{gte:cutoff,lte:new Date()},requestedBy:{not:actor}},data:{status:state,decidedBy:actor,decidedAt:new Date()}});
 if(result.count!==1)return false;
 await tx.staffAudit.create({data:{actorId:actor,action:state,resource:action.resource,targetId:action.targetId}});
 return true;
 });
 return changed?Response.json({status:state,execution:"NOT_EXECUTED"}):Response.json({error:"Already decided"},{status:409});
 }catch(error){return staffWriteError(error)}
}
