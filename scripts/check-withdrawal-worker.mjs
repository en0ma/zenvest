import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {registerHooks} from "node:module";
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="server-only")return nextResolve(new URL("./ci-server-only-shim.mjs",import.meta.url).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",import.meta.url).href,context);
 if(specifier.startsWith("./") && context.parentURL?.includes("/src/lib/") && !/\.[cm]?[jt]s$/.test(specifier))return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("CI database required");
const prisma=new PrismaClient();
const originalEnv={key:process.env.BLOCK_RADAR_API_KEY,wallet:process.env.BLOCK_RADAR_MASTER_WALLET_ID,asset:process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID};
const realFetch=globalThis.fetch;
const {processPendingWithdrawal}=await import("../src/lib/withdrawal-payout-worker.ts");
const {handleWithdrawalWebhook}=await import("../src/lib/withdrawal-webhook.ts");
const userId="ci_payout_worker_user";
const successId="cworkerwithdrawal00000001";
const unknownId="cworkerwithdrawal00000002";
const priorMint=process.env.BLOCKRADAR_SOLANA_USDC_MINT;
let treasuryStart=null;
let createdUser=false;
try{
 const deposit=await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
 process.env.BLOCK_RADAR_API_KEY="ci-provider-fixture";
 process.env.BLOCK_RADAR_MASTER_WALLET_ID=deposit.walletId;
 process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID="ci-usdc";
 process.env.BLOCKRADAR_SOLANA_USDC_MINT="ci-test-usdc-mint";
 treasuryStart=await prisma.treasury.findMany({where:{kind:{in:["DEPOSIT","DEALLOCATE","WITHDRAWAL_FEE"]}},select:{kind:true,amount:true}});
 await prisma.user.create({data:{id:userId,name:"CI Payout Worker",email:"ci-payout-worker@example.invalid",passwordHash:"ci-only",unallocated:100000000n}});
 createdUser=true;
 const make=(id,stamp)=>prisma.investorWithdrawal.create({data:{
  id,userId,amountUsdcMicros:5000001n,grossUsdcMicros:7000001n,
  feeUsdcMicros:2000000n,destinationAddress:"11111111111111111111111111111111",
  status:"PENDING",createdAt:new Date(stamp),updatedAt:new Date(stamp)
 }});
 let mode="insufficient",transfers=0;
 globalThis.fetch=async(url,init)=>{
  assert.match(String(url),/^https:\/\/api\.blockradar\.co\/v1\/wallets\//);
  if(String(url).includes("/balance"))return new Response(JSON.stringify({
   statusCode:200,data:{asset:"USDC",balance:mode==="insufficient"?"0.000001":"999999999999.000001"}
  }),{status:200});
  if(String(url).endsWith("/withdraw")){
   transfers++;
   const data=JSON.parse(String(init?.body));
   assert.equal(data.amount,"5.000001");
   assert.equal(data.assetId,"ci-usdc");
   assert.equal(data.address,"11111111111111111111111111111111");
   if(mode==="timeout")throw Error("Simulated provider timeout after network call");
   return new Response(JSON.stringify({data:{id:"ci-provider-accepted",hash:"ci-hash"}}),{status:200});
  }
  throw Error("Unexpected external network request");
 };
 const first=await make(successId,"1990-01-01T00:00:00Z");
 assert.equal(await processPendingWithdrawal(),"preflight_retry","insufficient master funds cannot trigger a payout");
 assert.equal((await prisma.investorWithdrawal.findUniqueOrThrow({where:{id:first.id}})).status,"PENDING");
 assert.equal(transfers,0);
 mode="success";
 assert.equal(await processPendingWithdrawal(),"submitted","provider acceptance is asynchronous, not final settlement");
 let accepted=await prisma.investorWithdrawal.findUniqueOrThrow({where:{id:first.id}});
 assert.equal(accepted.status,"PROCESSING");
 assert.equal(accepted.providerTransactionId,"ci-provider-accepted");
 assert.equal(accepted.transactionHash,"ci-hash");
 assert.equal(accepted.treasuryTransactionId,null,"provider acceptance cannot mint a completed transfer");
 assert.equal(transfers,1);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated,100000000n,
  "investor's available balance changes only on verified settlement");
 const second=await make(unknownId,new Date().toISOString());
 mode="timeout";
 assert.equal(await processPendingWithdrawal(),"review_pending","ambiguous payout response must retain REVIEW hold");
 const unknown=await prisma.investorWithdrawal.findUniqueOrThrow({where:{id:second.id}});
 assert.equal(unknown.status,"REVIEW");
 assert.equal(unknown.failureCode,"PAYOUT_RESPONSE_UNKNOWN");
 assert.equal(unknown.treasuryTransactionId,null);
 assert.equal(transfers,2);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated,100000000n);
 const signedData={
  id:"ci-provider-accepted",reference:"withdrawal:"+successId,amount:"5.000001",
  recipientAddress:"11111111111111111111111111111111",
  wallet:{id:deposit.walletId},type:"WITHDRAW",status:"SUCCESS",network:"testnet",
  asset:{address:"ci-test-usdc-mint",symbol:"USDC",decimals:6},
  hash:"ci-chain-confirmed",confirmed:true,metadata:{userId}
 };
 assert.equal(await handleWithdrawalWebhook("withdraw.success",signedData,deposit.walletId),"settled",
  "trusted verified provider callback must settle accepted withdrawal");
 assert.equal((await prisma.investorWithdrawal.findUniqueOrThrow({where:{id:first.id}})).status,"COMPLETED");
 const ledger=await prisma.treasuryTransfer.findUniqueOrThrow({where:{reference:"withdrawal:"+successId}});
 assert.equal(ledger.status,"COMPLETE");
 assert.equal(ledger.amountUsdcMicros,5000001n);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated,92999999n,
  "confirmed settlement must debit the gross amount including fixed fee exactly once");
 const parallelDuplicates=await Promise.all(Array.from({length:6},()=>handleWithdrawalWebhook("withdraw.success",signedData,deposit.walletId)));
 assert.deepEqual(parallelDuplicates,Array(6).fill("duplicate"),
  "simultaneous redelivery after settlement must remain idempotent");
 assert.equal(await prisma.treasuryTransfer.count({where:{reference:"withdrawal:"+successId}}),1);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated,92999999n,
  "replayed trusted callback cannot debit funds again");
 // A stale REVIEW must expire without contacting the provider or debiting funds.
 const stale=await prisma.investorWithdrawal.create({data:{
  id:"cworkerreviewexpired000001",userId,amountUsdcMicros:5000001n,
  grossUsdcMicros:7000001n,feeUsdcMicros:2000000n,
  destinationAddress:"11111111111111111111111111111111",
  status:"REVIEW",createdAt:new Date("2000-01-01T00:00:00Z")
 }});
 const transfersBeforeExpiry=transfers;
 assert.equal(await processPendingWithdrawal(),"review_expired");
 const expired=await prisma.investorWithdrawal.findUniqueOrThrow({where:{id:stale.id}});
 assert.equal(expired.status,"FAILED");
 assert.equal(expired.failureCode,"REVIEW_TIMEOUT");
 assert.equal(expired.treasuryTransactionId,null);
 assert.equal(transfers,transfersBeforeExpiry,"review expiration must not submit a payout");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated,92999999n);
 // Interrupted settlement must roll back ALL journal writes and remain retryable.
 const interruptedId="cworkerinterrupted0000003";
 const interruptedReference="withdrawal:"+interruptedId;
 await prisma.investorWithdrawal.create({data:{
  id:interruptedId,userId,amountUsdcMicros:5000001n,grossUsdcMicros:7000001n,
  feeUsdcMicros:2000000n,destinationAddress:"11111111111111111111111111111111",
  status:"PROCESSING",providerTransactionId:"ci-provider-interrupted"
 }});
 const beforeInterrupted=(await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated;
 const depositBeforeInterrupted=await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
 const deallocateBeforeInterrupted=await prisma.treasury.findUniqueOrThrow({where:{kind:"DEALLOCATE"}});
 await prisma.treasury.update({where:{kind:"DEPOSIT"},data:{amount:0n}});
 await prisma.treasury.update({where:{kind:"DEALLOCATE"},data:{amount:0n}});
 const interruptedData={...signedData,id:"ci-provider-interrupted",reference:interruptedReference,hash:"ci-interrupted-hash"};
 try{
  await assert.rejects(handleWithdrawalWebhook("withdraw.success",interruptedData,deposit.walletId),
   /Insufficient master treasury balance/);
  assert.equal((await prisma.investorWithdrawal.findUniqueOrThrow({where:{id:interruptedId}})).status,"PROCESSING",
   "failed settlement must roll back status transition");
  assert.equal(await prisma.treasuryTransfer.count({where:{reference:interruptedReference}}),0,
   "failed settlement cannot leave a completed treasury transfer");
  assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated,beforeInterrupted,
   "failed settlement cannot debit funds");
 }finally{
  await prisma.treasury.update({where:{kind:"DEPOSIT"},data:{amount:depositBeforeInterrupted.amount}});
  await prisma.treasury.update({where:{kind:"DEALLOCATE"},data:{amount:deallocateBeforeInterrupted.amount}});
 }
 assert.equal(await handleWithdrawalWebhook("withdraw.success",interruptedData,deposit.walletId),"settled",
  "corrected treasury state allows exactly one authenticated settlement");
 assert.equal(await handleWithdrawalWebhook("withdraw.success",interruptedData,deposit.walletId),"duplicate");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated,beforeInterrupted-7000001n);
 assert.equal(await prisma.treasuryTransfer.count({where:{reference:interruptedReference}}),1);
 console.log("Withdrawal worker PostgreSQL lifecycle passed: custody preflight, successful provider acceptance, unknown response enters REVIEW, signed settlement, one ledger entry, replay-safe gross debit");
}finally{
 globalThis.fetch=realFetch;
 for(const [name,value] of [["BLOCK_RADAR_API_KEY",originalEnv.key],["BLOCK_RADAR_MASTER_WALLET_ID",originalEnv.wallet],["BLOCKRADAR_SOLANA_USDC_ASSET_ID",originalEnv.asset]]){
  if(value===undefined)delete process.env[name];else process.env[name]=value;
 }
 await prisma.investorWithdrawal.deleteMany({where:{userId}});
 await prisma.investorActivity.deleteMany({where:{userId}});
 await prisma.treasuryTransfer.deleteMany({where:{reference:{in:["withdrawal:"+successId,"withdrawal:cworkerinterrupted0000003"]}}});
 if(treasuryStart)for(const entry of treasuryStart)await prisma.treasury.update({where:{kind:entry.kind},data:{amount:entry.amount}});
 if(priorMint===undefined)delete process.env.BLOCKRADAR_SOLANA_USDC_MINT;else process.env.BLOCKRADAR_SOLANA_USDC_MINT=priorMint;
 if(createdUser)await prisma.user.deleteMany({where:{id:userId}});
 await prisma.$disconnect();
}
