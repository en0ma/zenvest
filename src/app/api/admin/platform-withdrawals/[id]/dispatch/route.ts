import {requireStaffPermission} from "@/lib/staff-access";
import {staffWriteError} from "@/lib/staff-write-error";
import {processPendingPlatformWithdrawal} from "@/lib/platform-withdrawal-worker";
import {prisma} from "@/lib/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  await requireStaffPermission("wallets:operate",{requireFreshLogin:true});
  if(process.env.STAFF_PLATFORM_WITHDRAWALS_ENABLED!=="true")return Response.json({error:"Platform payouts disabled"},{status:503});
  const {id}=await params;
  const item=await prisma.platformWithdrawal.findUnique({where:{id},select:{id:true,status:true}});
  if(!item)return Response.json({error:"Platform payout not found"},{status:404});
  if(item.status!=="PENDING")return Response.json({error:"Already claimed or processed; do not retry"},{status:409});
  const result=await processPendingPlatformWithdrawal(id);
  return Response.json({status:result,execution:result==="submitted"?"PROVIDER_ACCEPTED_AWAITING_WEBHOOK":result==="preflight_retry"?"NOT_SUBMITTED":"REVIEW_REQUIRED_DO_NOT_RETRY"},{status:result==="submitted"?200:409,headers:{"Cache-Control":"no-store"}});
 }catch(error){return staffWriteError(error)}
}
