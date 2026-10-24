import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";

if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw new Error("CI database required");
const prisma=new PrismaClient();
const {processPendingWebhook}=await import("../src/lib/webhook-queue-worker.ts");
const {processPendingAllocations}=await import("../src/lib/allocation-payout-worker.ts");
const {processPendingWithdrawal}=await import("../src/lib/withdrawal-payout-worker.ts");
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
 // Verify payout workers refuse missing critical provider configuration before
 // claiming or moving any investor balances. Never invoke a provider in CI.
 const originalKey=process.env.BLOCK_RADAR_API_KEY;
 const originalWallet=process.env.BLOCK_RADAR_MASTER_WALLET_ID;
 const originalAsset=process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID;
 try{
  delete process.env.BLOCK_RADAR_API_KEY;
  delete process.env.BLOCK_RADAR_MASTER_WALLET_ID;
  await assert.rejects(()=>processPendingAllocations(),/not configured/i);
  await assert.rejects(()=>processPendingWithdrawal(),/not configured/i);
  process.env.BLOCK_RADAR_API_KEY="ci-only-provider-key";
  process.env.BLOCK_RADAR_MASTER_WALLET_ID="CI_TEST_WALLET";
  delete process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID;
  await assert.rejects(()=>processPendingAllocations(),/asset ID/i);
  await assert.rejects(()=>processPendingWithdrawal(),/asset ID/i);
 }finally{
  if(originalKey===undefined)delete process.env.BLOCK_RADAR_API_KEY;
  else process.env.BLOCK_RADAR_API_KEY=originalKey;
  if(originalWallet===undefined)delete process.env.BLOCK_RADAR_MASTER_WALLET_ID;
  else process.env.BLOCK_RADAR_MASTER_WALLET_ID=originalWallet;
  if(originalAsset===undefined)delete process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID;
  else process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID=originalAsset;
 }
 console.log("Financial worker integration tests passed: failed webhook durable retry and provider fail-closed configuration");
}finally{
 await prisma.$disconnect();
}
