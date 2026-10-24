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
 // A future retry must not be reprocessed early and cannot be double claimed.
 assert.equal(await processPendingWebhook(),"empty","retry backoff must hide future events");
 const leaseKey="ci-worker-active-lease";
 const locked=await prisma.webhookQueue.create({data:{
  source:"BLOCKRADAR",eventType:"deposit.success",idempotencyKey:leaseKey,
  payload:{notAValidEnvelope:true},status:"PENDING",
  createdAt:new Date("2001-01-01T00:00:00Z"),
  nextAttemptAt:new Date("2001-01-01T00:00:00Z"),
  leaseUntil:new Date(Date.now()+120000)
 }});
 try{
  assert.equal(await processPendingWebhook(),"empty","leased item must be skipped");
  assert.equal((await prisma.webhookQueue.findUniqueOrThrow({where:{id:locked.id}})).attempts,0);
  await prisma.webhookQueue.update({where:{id:locked.id},data:{leaseUntil:new Date("2001-01-01T00:00:00Z")}});
  assert.equal(await processPendingWebhook(),"retry_pending","expired lease must be recoverable");
  const recovered=await prisma.webhookQueue.findUniqueOrThrow({where:{id:locked.id}});
  assert.equal(recovered.attempts,1);
  assert.equal(recovered.leaseUntil,null);
  assert.equal(recovered.status,"PENDING");
 }finally{
  await prisma.webhookQueue.deleteMany({where:{id:locked.id}});
 }
 // Concurrent schedulers must only lease each durable event once.
 const concurrentKey="ci-worker-concurrent-lease";
 const concurrent=await prisma.webhookQueue.create({data:{
  source:"BLOCKRADAR",eventType:"deposit.success",idempotencyKey:concurrentKey,
  payload:{notAValidEnvelope:true},status:"PENDING",
  createdAt:new Date("2002-01-01T00:00:00Z"),
  nextAttemptAt:new Date("2002-01-01T00:00:00Z")
 }});
 try{
  const outcomes=await Promise.all([processPendingWebhook(),processPendingWebhook()]);
  assert.equal(outcomes.filter(x=>x==="retry_pending").length,1,
   "two workers must not both process the same event");
  assert.ok(outcomes.every(x=>["retry_pending","empty","already_claimed"].includes(x)));
  const state=await prisma.webhookQueue.findUniqueOrThrow({where:{id:concurrent.id}});
  assert.equal(state.attempts,1,"claiming must increment attempts exactly once");
  assert.equal(state.status,"PENDING");
  assert.equal(state.leaseUntil,null);
  assert.ok(state.nextAttemptAt.getTime()>Date.now());
 }finally{
  await prisma.webhookQueue.deleteMany({where:{id:concurrent.id}});
 }
 console.log("Financial worker integration tests passed: durable webhook retry, lease recovery and concurrent claiming");
}finally{
 await prisma.$disconnect();
}
