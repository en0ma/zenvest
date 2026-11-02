import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {blockradarConfig} from "@/lib/blockradar";
import {requireStaffPermission} from "@/lib/staff-access";
import {staffWriteError} from "@/lib/staff-write-error";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const actor=await requireStaffPermission("deposits:reconcile",{requireFreshLogin:true});
  if(process.env.STAFF_DEPOSIT_RECONCILIATION_ENABLED!=="true"||process.env.BLOCKRADAR_DEPOSITS_ENABLED!=="true")return Response.json({error:"Staff deposit reconciliation disabled"},{status:503});
  const {id}=await params;
  const action=await prisma.staffAction.findUnique({where:{id}});
  if(!action||action.resource!=="deposits"||action.operation!=="reconcile")return Response.json({error:"Deposit approval not found"},{status:404});
  if(action.status!=="APPROVED"||!action.decidedBy||action.decidedBy===action.requestedBy)return Response.json({error:"Independent approval required"},{status:409});
  const deposit=await prisma.blockchainDeposit.findUnique({where:{id:action.targetId},include:{wallet:true}});
  if(!deposit||deposit.status!=="CONFIRMING"||deposit.creditedAt||!deposit.providerTransactionId)return Response.json({error:"Deposit not eligible for replay"},{status:409});
  const {key,walletId}=blockradarConfig();
  if(deposit.wallet.masterWalletId!==walletId||deposit.wallet.status!=="ACTIVE"||deposit.wallet.provider!=="BLOCKRADAR"||deposit.wallet.network!=="solana")return Response.json({error:"Wallet identity mismatch"},{status:409});
  const claimed=await prisma.$transaction(async tx=>{
   const current=await tx.blockchainDeposit.findUnique({where:{id:deposit.id},select:{status:true,creditedAt:true}});
   if(!current||current.status!=="CONFIRMING"||current.creditedAt)return false;
   const updated=await tx.staffAction.updateMany({where:{id,status:"APPROVED",decidedBy:{not:null},requestedBy:{not:action.decidedBy},resource:"deposits",operation:"reconcile"},data:{status:"EXECUTED"}});
   if(updated.count!==1)return false;
   await tx.staffAudit.create({data:{actorId:actor,action:"deposit.webhook_replay.claimed",resource:"deposits",targetId:deposit.id}});
   return true;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(!claimed)return Response.json({error:"Approval already consumed or deposit completed"},{status:409});
  try{
   const url=`https://api.blockradar.co/v1/wallets/${encodeURIComponent(walletId)}/transactions/${encodeURIComponent(deposit.providerTransactionId)}/resend-webhook`;
   const response=await fetch(url,{method:"POST",headers:{"x-api-key":key},cache:"no-store",signal:AbortSignal.timeout(15000)});
   if(!response.ok)return Response.json({status:"REVIEW_REQUIRED",execution:"UNKNOWN_DO_NOT_RETRY"},{status:503});
  }catch{return Response.json({status:"REVIEW_REQUIRED",execution:"UNKNOWN_DO_NOT_RETRY"},{status:503});}
  return Response.json({status:"REPLAY_REQUESTED",execution:"AWAITING_SIGNED_BLOCKRADAR_WEBHOOK"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return staffWriteError(error)}
}
