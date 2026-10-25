import {NextResponse} from "next/server";
import {Prisma} from "@prisma/client";
import {requireUser} from "@/lib/access";
import {prisma} from "@/lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function amountMicros(value:unknown):bigint|null {
 if(typeof value!=="string"||!/^(0|[1-9]\\d*)(\\.\\d{1,6})?$/.test(value))return null;
 const [whole,part=""]=value.split(".");
 const n=BigInt(whole)*1000000n+BigInt(part.padEnd(6,"0"));
 return n>0n&&n<=9223372036854775807n?n:null;
}
export async function POST(request:Request){
 const session=await requireUser();
 let raw:unknown;
 try{raw=await request.json();}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 if(!raw||typeof raw!=="object")return NextResponse.json({error:"Invalid request"},{status:400});
 const body=raw as Record<string,unknown>;
 const amount=amountMicros(body.amount);
 const handle=typeof body.handle==="string"?body.handle.trim().replace(/^@/,"").toLowerCase():"";
 const key=typeof body.idempotencyKey==="string"?body.idempotencyKey:"";
 const save=body.saveRecipient===true;
 const name=typeof body.recipientName==="string"?body.recipientName.trim():"";
 if(!amount||!/^[a-z0-9]{8}$/.test(handle)||!/^[0-9a-f-]{36}$/i.test(key)||(save&&(name.length<1||name.length>120)))
   return NextResponse.json({error:"Valid amount, recipient handle and request key required"},{status:400});
 const existing=await prisma.send.findUnique({where:{idempotencyKey:key}});
 if(existing)return existing.senderUserId===session.id?
   NextResponse.json({id:existing.id,status:existing.status},{status:200}):
   NextResponse.json({error:"Request key already used"},{status:409});
 try{
  const result=await prisma.$transaction(async tx=>{
   const sender=await tx.user.findUniqueOrThrow({where:{id:session.id},select:{id:true,handle:true,unallocated:true,isActive:true,emailVerifiedAt:true}});
   const recipient=await tx.user.findUnique({where:{handle},select:{id:true,handle:true,isActive:true,emailVerifiedAt:true}});
   if(!sender.isActive||!sender.emailVerifiedAt||!recipient||!recipient.isActive||!recipient.emailVerifiedAt||recipient.id===sender.id)return {error:"Recipient unavailable or invalid",status:400};
   const [withdrawalHolds,allocationHolds]=await Promise.all([
    tx.withdrawal.aggregate({where:{userId:sender.id,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},_sum:{grossUsdcMicros:true}}),
    tx.positionAllocation.aggregate({where:{userId:sender.id,kind:"ALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","AWAITING_DEALLOCATION","AWAITING_WITHDRAWAL","REVIEW"]}},_sum:{amountUsdcMicros:true}})
   ]);
   const held=(withdrawalHolds._sum.grossUsdcMicros??0n)+(allocationHolds._sum.amountUsdcMicros??0n);
   if(sender.unallocated-held<amount)return {error:"Insufficient available balance",status:409};
   const debited=await tx.user.updateMany({where:{id:sender.id,unallocated:{gte:amount+held}},data:{unallocated:{decrement:amount}}});
   if(debited.count!==1)return {error:"Balance changed; retry",status:409};
   await tx.user.update({where:{id:recipient.id},data:{unallocated:{increment:amount}}});
   const send=await tx.send.create({data:{senderUserId:sender.id,recipientUserId:recipient.id,senderHandle:sender.handle,recipientHandle:recipient.handle,amount,status:"COMPLETED",idempotencyKey:key}});
   if(save)await tx.userRecipient.create({data:{userId:sender.id,kind:"SEND",name,handle:recipient.handle,status:"COMPLETED"}});
   return {id:send.id,status:send.status};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:10000});
  if("error" in result)return NextResponse.json({error:result.error},{status:result.status});
  return NextResponse.json(result,{status:201});
 }catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002"){
   const old=await prisma.send.findUnique({where:{idempotencyKey:key}});
   if(old&&old.senderUserId===session.id)return NextResponse.json({id:old.id,status:old.status},{status:200});
  }
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2034")return NextResponse.json({error:"Concurrent wallet update; retry"},{status:409});
  console.error(JSON.stringify({component:"internal-send",outcome:"failed",errorType:error instanceof Error?error.name:"unknown"}));
  return NextResponse.json({error:"Unable to complete transfer"},{status:503});
 }
}
