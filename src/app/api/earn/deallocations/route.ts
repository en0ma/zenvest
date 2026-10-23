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
   const pos=await tx.investorPosition.findFirst({where:{id:positionId,userId:user.id,status:"ACTIVE"}});
   if(!pos)return "INVALID";
   // One unsettled reduction per position keeps principal ownership unambiguous.
   const other=await tx.positionAllocation.count({where:{positionId,kind:"DEALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","REVIEW"]}}});
   if(other)return "BUSY";
   if(amount>pos.principalUsdcMicros)return "EXCEEDS";
   const op=await tx.positionAllocation.create({data:{
    userId:user.id,positionId:pos.id,strategyId:pos.strategyId,kind:"DEALLOCATE",status:"PENDING",amountUsdcMicros:amount,
   }});
   return op.id;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(outcome==="INVALID")return NextResponse.json({error:"Position is not active"},{status:409});
  if(outcome==="BUSY")return NextResponse.json({error:"Position already has a pending reduction"},{status:409});
  if(outcome==="EXCEEDS")return NextResponse.json({error:"Amount exceeds position principal"},{status:409});
  return NextResponse.json({operationId:outcome,status:"PENDING"},{status:201});
 }catch(error){
  return NextResponse.json({error:"Unable to request deallocation"},{status:503});
 }
}
