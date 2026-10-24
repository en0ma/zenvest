import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {blockradarConfig} from "@/lib/blockradar";
import {validBlockradarSignature} from "@/lib/blockradar-event-validation";

export const runtime="nodejs";
export const dynamic="force-dynamic";

// Authenticate at ingestion. No treasury, deposit, position or withdrawal
// mutations occur in this handler. Provider delivery is acknowledged ONLY
// after the payload has been durably committed to PostgreSQL.
export async function POST(request:Request){
 let key:string;
 try{key=blockradarConfig().key;}catch{
  return NextResponse.json({error:"Webhook unconfigured"},{status:503});
 }
 const raw=await request.text();
 const signature=request.headers.get("x-blockradar-signature");
 if(!validBlockradarSignature(raw,signature,key)){
  return NextResponse.json({error:"Invalid signature"},{status:401});
 }
 let parsed:unknown;
 try{parsed=JSON.parse(raw);}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 const envelope=parsed&&typeof parsed==="object"?parsed as Record<string,unknown>:null;
 const data=envelope?.data&&typeof envelope.data==="object"?envelope.data as Record<string,unknown>:null;
 if(!envelope||typeof envelope.event!=="string"||!envelope.event||envelope.event.length>120||
    !data||typeof data.id!=="string"||!data.id||data.id.length>160){
  return NextResponse.json({error:"Invalid webhook envelope"},{status:400});
 }
 // Different lifecycle events for the same provider transaction must not
 // deduplicate each other (deposit.success vs deposit.swept.success).
 const eventType=envelope.event;
 const idempotencyKey=createHash("sha256").update(eventType+"\0"+data.id).digest("hex");
 const payload={body:parsed,raw,signature};
 try{
  const existing=await prisma.webhookQueue.findUnique({
   where:{source_idempotencyKey:{source:"BLOCKRADAR",idempotencyKey}},
  });
  if(existing){
   const old=existing.payload as Record<string,unknown>;
   if(old.raw!==raw)return NextResponse.json({error:"Conflicting event identity"},{status:409});
   return NextResponse.json({message:"queued",duplicate:true},{status:200});
  }
  await prisma.webhookQueue.create({data:{
   source:"BLOCKRADAR",eventType,idempotencyKey,payload:payload as Prisma.InputJsonValue,
  }});
  return NextResponse.json({message:"queued"},{status:200});
 }catch(e){
  if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002"){
   const existing=await prisma.webhookQueue.findUnique({
    where:{source_idempotencyKey:{source:"BLOCKRADAR",idempotencyKey}},
   });
   const old=existing?.payload as Record<string,unknown>|undefined;
   if(old?.raw===raw)return NextResponse.json({message:"queued",duplicate:true},{status:200});
   return NextResponse.json({error:"Conflicting event identity"},{status:409});
  }
  return NextResponse.json({error:"Queue unavailable"},{status:503});
 }
}
