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
 if(typeof body.requestId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.requestId))
  return NextResponse.json({error:"Invalid request identifier"},{status:400});
 const reference=`position-reduce:${user.id}:${body.requestId}`;
 try {
  const existing=await prisma.positionDeallocation.findUnique({where:{requestKey:reference}});
  if(existing)return existing.positionId===positionId&&existing.amountUsdcMicros===amount
   ?NextResponse.json({operationId:existing.id,status:existing.status})
   :NextResponse.json({error:"Request identifier reused"},{status:409});
  const outcome=await prisma.$transaction(async tx=>{
   const pos=await tx.investorPosition.findFirst({where:{id:positionId,userId:user.id,status:"ACTIVE"}});
   if(!pos)return "INVALID";
   // One unsettled reduction per position keeps principal ownership unambiguous.
   const other=await tx.positionDeallocation.count({where:{positionId,status:{in:["PENDING","PROCESSING","PROCESSING"]}}});
   if(other)return "BUSY";
   if(amount>pos.principalUsdcMicros)return "EXCEEDS";
   const op=await tx.positionDeallocation.create({data:{
    userId:user.id,positionId:pos.id,status:"PENDING",amountUsdcMicros:amount,requestKey:reference,
   }});
   return op.id;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(outcome==="INVALID")return NextResponse.json({error:"Position is not active"},{status:409});
  if(outcome==="BUSY")return NextResponse.json({error:"Position already has a pending reduction"},{status:409});
  if(outcome==="EXCEEDS")return NextResponse.json({error:"Amount exceeds position principal"},{status:409});
  return NextResponse.json({operationId:outcome,status:"PENDING"},{status:201});
 }catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002"){
   const existing=await prisma.positionDeallocation.findUnique({where:{requestKey:reference}});
   if(existing&&existing.positionId===positionId&&existing.amountUsdcMicros===amount)
    return NextResponse.json({operationId:existing.id,status:existing.status});
  }
  return NextResponse.json({error:"Unable to request deallocation"},{status:503});
 }
}
