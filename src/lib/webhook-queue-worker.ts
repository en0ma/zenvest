import {prisma} from "./db.ts";
import {processVerifiedBlockradarQueueItem} from "./blockradar-webhook-processing.ts";

// Process one queued message per invocation. The short claim transaction prevents
// overlapping cron workers from running the same item concurrently.
export async function processPendingWebhook(){
 const now=new Date();
 const candidate=await prisma.webhookQueue.findFirst({
  where:{source:"BLOCKRADAR",status:"PENDING",nextAttemptAt:{lte:now},
   OR:[{leaseUntil:null},{leaseUntil:{lte:now}}]},
  orderBy:[{createdAt:"asc"},{id:"asc"}],
 });
 if(!candidate)return "empty";
 const claimed=await prisma.webhookQueue.updateMany({
  where:{id:candidate.id,status:"PENDING",nextAttemptAt:{lte:now},
   OR:[{leaseUntil:null},{leaseUntil:{lte:now}}]},
  data:{leaseUntil:new Date(now.getTime()+120000),attempts:{increment:1}},
 });
 if(claimed.count!==1)return "already_claimed";
 const body=candidate.payload as Record<string,unknown>;
 let result="retry_pending";
 let detail="processing_failed";
 try{
  if(typeof body.raw!=="string"||typeof body.signature!=="string")throw Error("Invalid durable webhook envelope");
  const request=new Request("https://internal.invalid/api/webhooks/blockradar",{
   method:"POST",headers:{"x-blockradar-signature":body.signature},body:body.raw,
  });
  const response=await processVerifiedBlockradarQueueItem(request);
  if(response.ok){
   await prisma.webhookQueue.updateMany({where:{id:candidate.id,status:"PENDING"},
    data:{status:"PROCESSED",processedAt:new Date(),leaseUntil:null,lastError:null}});
   return "processed";
  }
  detail="handler_http_"+response.status;
 }catch(e){
  detail=e instanceof Error?e.name:"unknown_error";
 }
 // Keep failed items PENDING and delay retry; never lose durable provider data.
 const attempts=candidate.attempts+1;
 const delay=Math.min(3600,30*Math.pow(2,Math.min(7,attempts-1)));
 await prisma.webhookQueue.updateMany({
  where:{id:candidate.id,status:"PENDING"},
  data:{leaseUntil:null,nextAttemptAt:new Date(Date.now()+delay*1000),lastError:detail},
 });
 return result;
}
