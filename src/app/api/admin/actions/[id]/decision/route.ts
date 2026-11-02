import {NextRequest} from "next/server";
import {prisma} from "@/lib/db";
import {requireStaffPermission} from "@/lib/staff-access";
import type {StaffPermissionKey} from "@/lib/staff-permissions";
const supported:Record<string,StaffPermissionKey>={"users:write":"users:write","deposits:reconcile":"deposits:reconcile","withdrawals:approve":"withdrawals:approve","balances:adjust":"balances:adjust","wallets:operate":"wallets:operate"};
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
 const {id}=await params;const body:unknown=await request.json();
 if(!body||typeof body!=="object"||!("approve" in body)||typeof body.approve!=="boolean")return Response.json({error:"Invalid decision"},{status:400});
 const action=await prisma.staffAction.findUnique({where:{id}});
 if(!action)return Response.json({error:"Not found"},{status:404});
 const permission=supported[action.resource+":"+action.operation];
 if(!permission)return Response.json({error:"Unsupported operation"},{status:400});
 const actor=await requireStaffPermission(permission);
 if(actor===action.requestedBy)return Response.json({error:"Self-approval prohibited"},{status:403});
 const state=body.approve?"APPROVED":"REJECTED";
 const changed=await prisma.$transaction(async tx=>{
 const result=await tx.staffAction.updateMany({where:{id,status:"PENDING"},data:{status:state,decidedBy:actor,decidedAt:new Date()}});
 if(result.count!==1)return false;
 await tx.staffAudit.create({data:{actorId:actor,action:state,resource:action.resource,targetId:action.targetId}});
 return true;
 });
 return changed?Response.json({status:state,execution:"NOT_EXECUTED"}):Response.json({error:"Already decided"},{status:409});
 }catch{return Response.json({error:"Not authorized"},{status:403})}
}
