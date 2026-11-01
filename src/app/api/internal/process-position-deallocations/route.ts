import {NextResponse} from "next/server";
import {authorizedCron} from "@/lib/cron-auth";
import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {processMockDeallocationSubmissions} from "@/lib/kalshi-deallocation-submission-worker";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// Kalshi outbound rail is not connected. Create final close requests but NEVER
// debit positions or mark deallocations completed without authenticated return custody.
export async function GET(request:Request){
 if(!authorizedCron(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 try{
  const candidates=await prisma.investorPosition.findMany({where:{status:"CLOSING",lastPnlUpdated:true},take:50,orderBy:{createdAt:"asc"}});
  let created=0,closedWithoutFunds=0;
  for(const p of candidates){
   const result=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${p.strategyId} FOR UPDATE`;
    const position=await tx.investorPosition.findUnique({where:{id:p.id}});
    if(!position||position.status!=="CLOSING"||!position.lastPnlUpdated)return "skip";
    const outstanding=await tx.positionAllocation.count({where:{positionId:p.id,status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","AWAITING_DEALLOCATION","DEALLOCATING","AWAITING_WITHDRAWAL","REVIEW"]}}});
    if(outstanding)return "skip";
    const exposure=await tx.positionTradePnl.count({where:{positionId:p.id,status:"SNAPSHOTTED"}});
    if(exposure)return "skip";
    if(position.allocatedUsdcMicros===0n){
     await tx.investorPosition.update({where:{id:p.id},data:{status:"CLOSED",closedAt:new Date()}});
     return "closed";
    }
    await tx.positionAllocation.create({data:{userId:p.userId,positionId:p.id,strategyId:p.strategyId,
     kind:"DEALLOCATE",amountUsdcMicros:position.allocatedUsdcMicros,status:"PENDING"}});
    return "created";
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
   if(result==="created")created++;if(result==="closed")closedWithoutFunds++;
  }
  const pending=await prisma.positionAllocation.aggregate({where:{kind:"DEALLOCATE",status:"PENDING",
   position:{OR:[{status:"OPEN"},{status:"CLOSING",lastPnlUpdated:true}]}},_count:{_all:true},_sum:{amountUsdcMicros:true}});
  const submission=await processMockDeallocationSubmissions();
  return NextResponse.json({status:"awaiting_verified_kalshi_return_integration",submission,direction:"kalshi_to_master",
   createdFinalCloseRequests:created,closedWithoutFunds,
   eligibleRequests:pending._count._all,amountUsdcMicros:(pending._sum.amountUsdcMicros??0n).toString()});
 }catch(error){console.error(JSON.stringify({component:"deallocation-worker",errorType:error instanceof Error?error.name:"unknown"}));
  return NextResponse.json({error:"Deallocation coordinator failed"},{status:503});}
}
