import {prisma} from "@/lib/db";
import {requireStaffPermission} from "@/lib/staff-access";
import {staffWriteError} from "@/lib/staff-write-error";
import {reviewAlertCutoff} from "@/lib/withdrawal-review-timeout";
import {lookupBlockradarWithdrawal} from "@/lib/blockradar-withdrawal-review";
import {handleWithdrawalWebhook} from "@/lib/withdrawal-webhook";
import {blockradarConfig} from "@/lib/blockradar";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const actorId=await requireStaffPermission("wallets:operate",{requireFreshLogin:true});
  const {id}=await params;
  if(!/^c[a-z0-9]{10,40}$/.test(id))return Response.json({error:"Invalid withdrawal reference"},{status:400});
  const record=await prisma.withdrawal.findUnique({where:{id}});
  if(!record)return Response.json({error:"Withdrawal not found"},{status:404});
  if(record.status!=="REVIEW")return Response.json({error:"Withdrawal is not in REVIEW"},{status:409});
  if(record.updatedAt>reviewAlertCutoff(new Date()))
   return Response.json({error:"Review resolution becomes available two hours after the last withdrawal status update"},{status:409});
  const {walletId}=blockradarConfig();
  const result=await lookupBlockradarWithdrawal(id,record.providerTransactionId);
  let outcome="unresolved",reason="pending_provider_outcome";
  if(result.kind==="unresolved")reason=result.reason;
  else{
   const data=result.data;
   // A fetched record is authoritative only if every financial field and
   // custody property matches the existing signed-webhook settlement policy.
   // Never fabricate a successful transaction or treat absence as failure.
   const status=data.status;
   const event=status==="SUCCESS"?"withdraw.success":
    status==="FAILED"?"withdraw.failed":status==="CANCELLED"?"withdraw.cancelled":null;
   if(event&&data.confirmed!==false&&
       (event!=="withdraw.success"||(data.confirmed===true&&typeof data.hash==="string"&&Boolean(data.hash)))){
    outcome=await handleWithdrawalWebhook(event,data,walletId);
    reason=outcome==="settled"?"provider_verified":outcome;
   }else reason="provider_not_final";
  }
  await prisma.staffAudit.create({data:{
   actorId,action:"withdrawal.review.lookup."+outcome,resource:"wallets",targetId:id
  }});
  return Response.json({outcome,reason,reserved:outcome!=="settled",
   status:outcome==="settled"?"SETTLED":"REVIEW_OR_ALREADY_SETTLED"},
   {headers:{"Cache-Control":"no-store"}});
 }catch(error){
  if(error instanceof Error&&/Blockradar transaction lookup unavailable|Unexpected Blockradar transaction list/.test(error.message))
   return Response.json({error:"Provider lookup unavailable; withdrawal remains reserved"},{status:503,headers:{"Cache-Control":"no-store"}});
  return staffWriteError(error);
 }
}
