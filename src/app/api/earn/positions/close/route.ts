import {NextResponse} from "next/server";
import {Prisma} from "@prisma/client";
import {requireUser} from "@/lib/access";
import {prisma} from "@/lib/db";
export const runtime="nodejs";
export async function POST(request:Request){
 const user=await requireUser();
 let data:unknown;try{data=await request.json();}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 const id=data&&typeof data==="object"&&(data as Record<string,unknown>).positionId;
 if(typeof id!=="string"||!/^c[a-z0-9]{10,40}$/.test(id))return NextResponse.json({error:"Invalid position"},{status:400});
 try{
 const result=await prisma.$transaction(async tx=>{
  const pos=await tx.investorPosition.findFirst({where:{id,userId:user.id}});
  if(!pos||pos.status==="CLOSED")return "unavailable";
  if(pos.status==="CLOSING")return "already_closing";
  await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${pos.strategyId} FOR UPDATE`;
  const pendingAllocations=await tx.positionAllocation.count({where:{positionId:id,kind:"ALLOCATE",
   status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","AWAITING_DEALLOCATION","DEALLOCATING","AWAITING_WITHDRAWAL","REVIEW"]}}});
  if(pendingAllocations)return "allocation_pending";
  const pendingDeallocations=await tx.positionAllocation.count({where:{positionId:id,kind:"DEALLOCATE",
   status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","AWAITING_DEALLOCATION","DEALLOCATING","AWAITING_WITHDRAWAL","REVIEW"]}}});
  if(pendingDeallocations)return "deallocation_pending";
  const exposure=await tx.positionTradePnl.count({where:{positionId:id,status:"SNAPSHOTTED"}});
  const ready=exposure===0;
  const claimed=await tx.investorPosition.updateMany({where:{id,status:"OPEN"},
   data:{status:ready&&pos.allocatedUsdcMicros===0n?"CLOSED":"CLOSING",lastPnlUpdated:ready,
    ...(ready&&pos.allocatedUsdcMicros===0n?{closedAt:new Date()}:{})}});
  if(claimed.count!==1)throw new Error("Position close raced");
  // The deallocation coordination worker creates the final amount only once P&L is final.
  return ready&&pos.allocatedUsdcMicros===0n?"closed":"closing";
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 return result==="unavailable"?NextResponse.json({error:"Position cannot be closed"},{status:409}):
  result==="allocation_pending"||result==="deallocation_pending"?NextResponse.json({error:"Settle pending capital requests before closing"},{status:409}):
  NextResponse.json({status:result});
 }catch{return NextResponse.json({error:"Unable to request position closure"},{status:503});}
}
