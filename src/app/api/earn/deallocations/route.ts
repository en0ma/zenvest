import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function micros(raw:unknown):bigint|null {
 if(typeof raw!=="string"||!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(raw))return null;
 const [w,f=""]=raw.split(".");
 const n=BigInt(w)*1000000n+BigInt(f.padEnd(6,"0"));
 return n>0n&&n<=9223372036854775807n?n:null;
}
export async function POST(request:Request){
 const user=await requireUser();
 let raw:unknown;try{raw=await request.json();}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 const body=raw&&typeof raw==="object"?raw as Record<string,unknown>:{};
 const positionId=body.positionId;
 const amount=micros(body.amount);
 if(typeof positionId!=="string"||!/^c[a-z0-9]{10,40}$/.test(positionId)||!amount)
  return NextResponse.json({error:"Invalid position or reduction amount"},{status:400});
 try {
  const outcome=await prisma.$transaction(async tx=>{
   const candidate=await tx.investorPosition.findFirst({where:{id:positionId,userId:user.id},select:{strategyId:true}});
   if(!candidate)return "INVALID";
   await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${candidate.strategyId} FOR UPDATE`;
   // Re-read after taking the shared strategy lock so a concurrent close
   // cannot admit a new deallocation using a stale OPEN position snapshot.
   const pos=await tx.investorPosition.findFirst({where:{id:positionId,userId:user.id}});
   if(pos?.status==="CLOSING")return "POSITION_CLOSING";
   if(!pos||pos.status!=="OPEN")return "INVALID";
   const unsettled=await tx.positionAllocation.aggregate({where:{
    positionId,userId:user.id,kind:"DEALLOCATE",
    status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","AWAITING_DEALLOCATION","AWAITING_WITHDRAWAL","REVIEW"]},
   },_sum:{amountUsdcMicros:true}});
   const reserved=unsettled._sum.amountUsdcMicros??0n;
   const available=pos.allocatedUsdcMicros>reserved?pos.allocatedUsdcMicros-reserved:0n;
   if(amount>available)return "EXCEEDS";
   const op=await tx.positionAllocation.create({data:{
    userId:user.id,positionId:pos.id,strategyId:pos.strategyId,kind:"DEALLOCATE",status:"PENDING",amountUsdcMicros:amount,
   }});
   return op.id;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(outcome==="POSITION_CLOSING")return NextResponse.json({error:"This position is closing; no new deallocation requests are accepted"},{status:409});
  if(outcome==="INVALID")return NextResponse.json({error:"Position is not active"},{status:409});
  if(outcome==="EXCEEDS")return NextResponse.json({error:"Amount exceeds unreserved position balance"},{status:409});
  return NextResponse.json({operationId:outcome,status:"PENDING"},{status:201});
 }catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2034")return NextResponse.json({error:"Concurrent request; retry"},{status:409});
  return NextResponse.json({error:"Unable to request deallocation"},{status:503});
 }
}
