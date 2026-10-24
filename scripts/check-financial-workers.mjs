import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {registerHooks} from "node:module";
registerHooks({
 resolve(specifier,context,nextResolve){
  if(specifier.startsWith("@/lib/")){
   const target=new URL("../src/lib/"+specifier.slice(6)+(specifier.endsWith(".ts")?"":".ts"),import.meta.url);
   return nextResolve(target.href,context);
  }
  return nextResolve(specifier,context);
 }
});

if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw new Error("CI database required");
const prisma=new PrismaClient();
const {processPendingWebhook}=await import("../src/lib/webhook-queue-worker.ts");
const key="ci-worker-malformed-envelope";

try {
 const existing=await prisma.webhookQueue.findFirst({where:{idempotencyKey:key}});
 if(existing)await prisma.webhookQueue.delete({where:{id:existing.id}});
 const record=await prisma.webhookQueue.create({data:{
  source:"BLOCKRADAR",eventType:"deposit.success",idempotencyKey:key,
  payload:{notAValidEnvelope:true},status:"PENDING",attempts:0,
  createdAt:new Date("2000-01-01T00:00:00Z"),nextAttemptAt:new Date("2000-01-01T00:00:00Z")
 }});
 try{
  assert.equal(await processPendingWebhook(),"retry_pending");
  const after=await prisma.webhookQueue.findUniqueOrThrow({where:{id:record.id}});
  assert.equal(after.status,"PENDING","durable webhook must not be lost");
  assert.equal(after.attempts,1,"failed delivery must increment attempts");
  assert.equal(after.leaseUntil,null,"failed delivery must release its lease");
  assert.equal(after.lastError,"Error","malformed envelope must record error class");
  assert.ok(after.nextAttemptAt.getTime()>Date.now(),"retry must be delayed");
 }finally{
  await prisma.webhookQueue.deleteMany({where:{id:record.id}});
 }
 console.log("Financial worker integration tests passed: failed webhook durable retry");
}finally{
 await prisma.$disconnect();
}
