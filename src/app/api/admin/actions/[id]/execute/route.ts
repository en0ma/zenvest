import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {requireStaffPermission} from "@/lib/staff-access";
import {staffWriteError} from "@/lib/staff-write-error";
import {guardFinancialExecution} from "@/lib/staff-financial-execution";
import {processPendingWithdrawal} from "@/lib/withdrawal-payout-worker";
import {classifyStaffDispatchResult} from "@/lib/staff-withdrawal-dispatch-policy";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Dispatch an already-created user withdrawal through the existing Blockradar payout worker.
 * The worker's signed provider webhook, not this endpoint, settles balances and treasury.
 */
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const actor=await requireStaffPermission("withdrawals:approve",{requireFreshLogin:true});
  if(process.env.STAFF_WITHDRAWAL_EXECUTION_ENABLED!=="true")
   return Response.json({error:"Staff withdrawal dispatch is disabled"},{status:503});
  const {id}=await params;
  const action=await prisma.staffAction.findUnique({where:{id}});
  if(!action||action.resource!=="withdrawals"||action.operation!=="approve")return Response.json({error:"Withdrawal approval not found"},{status:404});
  const guard=guardFinancialExecution({
   operation:"withdrawals:approve",actionStatus:action.status,approvedBy:action.decidedBy,
   requestedBy:action.requestedBy,actorId:actor,idempotencyKey:action.idempotencyKey
  },true);
  if(!guard.allowed)return Response.json({error:guard.reason},{status:409});
  const withdrawal=await prisma.withdrawal.findUnique({where:{id:action.targetId},select:{id:true,status:true,treasuryTransactionId:true}});
  if(!withdrawal||withdrawal.status!=="PENDING"||withdrawal.treasuryTransactionId)
   return Response.json({error:"Withdrawal is not eligible for dispatch"},{status:409});
  // Consume approval before making any external call. Concurrent requests cannot
  // dispatch a second time. A process crash leaves the action consumed for review.
  const claimed=await prisma.$transaction(async tx=>{
   const updated=await tx.staffAction.updateMany({
    where:{id:action.id,status:"APPROVED",decidedBy:{not:null},requestedBy:{not:action.decidedBy!},resource:"withdrawals",operation:"approve"},
    data:{status:"EXECUTED"}
   });
   if(updated.count!==1)return false;
   await tx.staffAudit.create({data:{actorId:actor,action:"withdrawal.dispatch.claimed",resource:"withdrawals",targetId:withdrawal.id}});
   return true;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(!claimed)return Response.json({error:"Approval already consumed"},{status:409});
  // This uses the same custody validation, balance reservations and Blockradar
  // submission as the user withdrawal worker. No manual ledger debit occurs here.
  let result:string;
  try{result=await processPendingWithdrawal(withdrawal.id)}
  catch{
   // Unknown whether the provider was contacted: never reset to APPROVED.
   return Response.json({status:"REVIEW_REQUIRED",execution:"UNKNOWN_DO_NOT_RETRY"},{status:503});
  }
  const disposition=classifyStaffDispatchResult(result);
  if(disposition==="REVIEW"){
   // Another worker may have claimed or submitted the target. Never rearm an
   // approval after a possibly started custody transfer.
   return Response.json({status:result,execution:"REVIEW_REQUIRED_DO_NOT_RETRY"},{status:409,headers:{"Cache-Control":"no-store"}});
  }
  if(disposition==="SAFE_NO_PROVIDER_ATTEMPT"){
   // The worker reports these only when it did not call the custody provider.
   // Re-enable approval only after verifying the target has not been claimed.
   await prisma.$transaction(async tx=>{
    const pending=await tx.withdrawal.findUnique({where:{id:withdrawal.id},select:{status:true,providerTransactionId:true,treasuryTransactionId:true}});
    if(!pending||pending.status!=="PENDING"||pending.providerTransactionId||pending.treasuryTransactionId)return;
    const updated=await tx.staffAction.updateMany({where:{id:action.id,status:"EXECUTED"},data:{status:"APPROVED"}});
    if(updated.count===1)await tx.staffAudit.create({data:{actorId:actor,action:"withdrawal.dispatch.not_submitted",resource:"withdrawals",targetId:withdrawal.id}});
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
   return Response.json({status:result,execution:"NOT_SUBMITTED_OR_REVIEW_REQUIRED"},{status:409,headers:{"Cache-Control":"no-store"}});
  }
  return Response.json({status:result,execution:result==="submitted"?"PROVIDER_ACCEPTED_AWAITING_WEBHOOK":"UNKNOWN_DO_NOT_RETRY"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return staffWriteError(error)}
}
