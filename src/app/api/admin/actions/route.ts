import {NextRequest} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {validateActionTarget} from "@/lib/staff-review-policy";
import {requireStaffPermission} from "@/lib/staff-access";
import type {StaffPermissionKey} from "@/lib/staff-permissions";
const supported:Record<string,StaffPermissionKey>={"users:write":"users:write","deposits:reconcile":"deposits:reconcile","withdrawals:approve":"withdrawals:approve","balances:adjust":"balances:adjust","wallets:operate":"wallets:operate"};
const proposal=z.object({resource:z.string(),operation:z.string(),targetId:z.string().min(1).max(128),reason:z.string().min(12).max(500),idempotencyKey:z.string().min(12).max(100)}).strict();
export async function POST(request:NextRequest){
 try{
 const parsed=proposal.safeParse(await request.json());
 if(!parsed.success)return Response.json({error:"Invalid request"},{status:400});
 const input=parsed.data;const permission=supported[input.resource+":"+input.operation];
 if(!permission||!validateActionTarget(input.resource,input.operation))return Response.json({error:"Unsupported operation"},{status:400});
 const actor=await requireStaffPermission(permission);
 const exists=await (async()=>{
  if(input.resource==="users"||input.resource==="balances")return Boolean(await prisma.user.findUnique({where:{id:input.targetId},select:{id:true}}));
  if(input.resource==="deposits")return Boolean(await prisma.blockchainDeposit.findUnique({where:{id:input.targetId},select:{id:true}}));
  if(input.resource==="withdrawals")return Boolean(await prisma.withdrawal.findUnique({where:{id:input.targetId},select:{id:true}}));
  if(input.resource==="wallets")return Boolean(await prisma.investorDepositWallet.findUnique({where:{id:input.targetId},select:{id:true}}));
  return false;
 })();
 if(!exists)return Response.json({error:"Target not found"},{status:404});
 const record=await prisma.$transaction(async tx=>{
 const action=await tx.staffAction.create({data:{...input,requestedBy:actor,payload:{}}});
 await tx.staffAudit.create({data:{actorId:actor,action:"proposed",resource:input.resource,targetId:input.targetId}});
 return action;
 });
 return Response.json({id:record.id,status:record.status,execution:"NOT_EXECUTED"},{status:201});
 }catch(error){
 if(error&&typeof error==="object"&&"code" in error&&error.code==="P2002")return Response.json({error:"Duplicate idempotency key"},{status:409});
 return Response.json({error:"Not authorized"},{status:403});
 }
}


export async function GET(){
 try{
  await requireStaffPermission("audit:read");
  const data=await prisma.staffAction.findMany({take:50,orderBy:{createdAt:"desc"},select:{id:true,resource:true,operation:true,targetId:true,reason:true,requestedBy:true,decidedBy:true,status:true,createdAt:true,decidedAt:true}});
  return Response.json({data},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return Response.json({error:"Access denied"},{status:403});
 }
}
