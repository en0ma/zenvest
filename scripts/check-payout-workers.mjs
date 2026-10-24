import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {registerHooks} from "node:module";
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="server-only")return nextResolve(new URL("./ci-server-only-shim.mjs",import.meta.url).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("CI database required");
const prisma=new PrismaClient();
const originalEnv={key:process.env.BLOCK_RADAR_API_KEY,wallet:process.env.BLOCK_RADAR_MASTER_WALLET_ID,asset:process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID};
const realFetch=globalThis.fetch;
const {processPendingAllocations}=await import("../src/lib/allocation-payout-worker.ts");
const {handleAllocationWebhook}=await import("../src/lib/allocation-webhook.ts");
const strategyId="ci_worker_allocation";
const walletAddress="11111111111111111111111111111111";
let positionId=null,allocationId=null,eventId=null;
const priorMint=process.env.BLOCKRADAR_SOLANA_USDC_MINT;
let originalDeposit=null;
try{
 const deposit=await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
 process.env.BLOCK_RADAR_API_KEY="ci-provider-fixture";
 process.env.BLOCK_RADAR_MASTER_WALLET_ID=deposit.walletId;
 process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID="ci-usdc";
 process.env.BLOCKRADAR_SOLANA_USDC_MINT="ci-mint";
 originalDeposit=deposit.amount;
 await prisma.strategy.create({data:{id:strategyId,name:"CI Payout Worker Strategy",description:"Isolated payout worker lifecycle test",kalshiWalletAddress:walletAddress}});
 const position=await prisma.investorPosition.create({data:{userId:"ci_test_user",strategyId}});
 positionId=position.id;
 const pending=await prisma.positionAllocation.create({data:{
   userId:"ci_test_user",positionId,strategyId,kind:"ALLOCATE",
   amountUsdcMicros:1500001n,status:"PENDING",createdAt:new Date("2000-01-01T00:00:00.000Z")
 }});
 allocationId=pending.id;
 let transfers=0,balances=0;
 let mode="insufficient";
 globalThis.fetch=async(url,init)=>{
  assert.match(String(url),/^https:\/\/api\.blockradar\.co\/v1\/wallets\//);
  if(String(url).includes("/balance")){
   balances++;
   return new Response(JSON.stringify({statusCode:200,data:{asset:"USDC",balance:mode==="insufficient"?"0.000001":"999999999999.000001"}}),{status:200});
  }
  if(String(url).endsWith("/withdraw")){
   transfers++;
   const data=JSON.parse(String(init?.body));
   assert.equal(data.amount,"1.500001");
   assert.equal(data.address,walletAddress);
   assert.equal(data.assetId,"ci-usdc");
   assert.match(data.reference,/^strategy_withdrawal:/);
   if(mode==="timeout")throw Error("Simulated provider timeout");
   return new Response(JSON.stringify({data:{id:"ci-provider-acceptance"}}),{status:200});
  }
  throw Error("Unexpected external HTTP");
 };
 const before=await prisma.user.findUniqueOrThrow({where:{id:"ci_test_user"}});
 assert.equal(await processPendingAllocations(),"preflight_retry","insufficient custody must release the unsubmitted claim");
 let after=await prisma.positionAllocation.findUniqueOrThrow({where:{id:allocationId}});
 assert.equal(after.status,"PENDING");
 assert.equal(after.strategyEventId,null);
 assert.equal(transfers,0,"insufficient custody must not issue a transfer");
 mode="success";
 assert.equal(await processPendingAllocations(),"submitted","verified custody should submit one allocation");
 after=await prisma.positionAllocation.findUniqueOrThrow({where:{id:allocationId}});
 assert.equal(after.status,"PROCESSING");
 assert.ok(after.strategyEventId);
 eventId=after.strategyEventId;
 const event=await prisma.strategyEvent.findUniqueOrThrow({where:{id:eventId}});
 assert.equal(event.status,"PROCESSING");
 assert.equal(event.amountUsdcMicros,1500001n);
 assert.equal(event.treasuryTransactionId,null,"submission alone must never create a settled treasury transfer");
 assert.equal(event.sourceConfirmed,false);
 assert.equal(event.destinationConfirmed,false);
 assert.equal(transfers,1);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:"ci_test_user"}})).unallocated,before.unallocated,
  "unconfirmed allocation cannot move investor funds");
 assert.equal(await processPendingAllocations(),"empty","submitted transfer cannot be re-sent");
 assert.equal(transfers,1);
 const timedOut=await prisma.positionAllocation.create({data:{
  userId:"ci_test_user",positionId,strategyId,kind:"ALLOCATE",
  amountUsdcMicros:1500001n,status:"PENDING"
 }});
 mode="timeout";
 assert.equal(await processPendingAllocations(),"review_pending",
  "uncertain transfer outcome must never be silently resubmitted");
 const review=await prisma.positionAllocation.findUniqueOrThrow({where:{id:timedOut.id}});
 assert.equal(review.status,"REVIEW");
 assert.ok(review.strategyEventId);
 assert.equal(transfers,2);
 assert.equal(await processPendingAllocations(),"empty");
 assert.equal(transfers,2,"ambiguous allocation must not be resent");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:"ci_test_user"}})).unallocated,before.unallocated);
 const signedEvent={
  id:"ci-accepted-transfer-1",reference:"strategy_withdrawal:"+eventId,
  amount:"1.500001",recipientAddress:walletAddress,
  wallet:{id:deposit.walletId},type:"WITHDRAW",status:"SUCCESS",network:"testnet",
  asset:{symbol:"USDC",decimals:6,address:"ci-mint"},hash:"ci-verified-onchain-1",confirmed:true
 };
 assert.equal(await handleAllocationWebhook("withdraw.success",signedEvent,deposit.walletId),
  "awaiting_kalshi_receipt","source provider confirmation must record custody movement");
 assert.equal(await handleAllocationWebhook("withdraw.success",signedEvent,deposit.walletId),
  "duplicate","repeated source confirmation cannot charge master twice");
 const sourceEvent=await prisma.strategyEvent.findUniqueOrThrow({where:{id:eventId}});
 assert.equal(sourceEvent.status,"CONFIRMING");
 assert.equal(sourceEvent.sourceConfirmed,true);
 assert.equal(sourceEvent.destinationConfirmed,false);
 const ledger=await prisma.treasuryTransfer.findUniqueOrThrow({where:{reference:"strategy_withdrawal:"+eventId}});
 assert.equal(ledger.direction,"ALLOCATE");
 assert.equal(ledger.status,"PROCESSING","source-only callback is not final strategy receipt");
 assert.equal(ledger.amountUsdcMicros,1500001n);
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}})).amount,
  originalDeposit-1500001n,"verified source custody must debit once");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:"ci_test_user"}})).unallocated,before.unallocated,
  "source-only movement must not settle investor equity");
 assert.equal((await prisma.positionAllocation.findUniqueOrThrow({where:{id:allocationId}})).status,"CONFIRMING");
 console.log("Allocation worker PostgreSQL lifecycle passed: insufficient custody retry, successful provider acceptance, no premature settlement, no resubmission");
}finally{
 globalThis.fetch=realFetch;
 for(const [name,value] of [["BLOCK_RADAR_API_KEY",originalEnv.key],["BLOCK_RADAR_MASTER_WALLET_ID",originalEnv.wallet],["BLOCKRADAR_SOLANA_USDC_ASSET_ID",originalEnv.asset]]){
  if(value===undefined)delete process.env[name];else process.env[name]=value;
 }
 await prisma.positionAllocation.deleteMany({where:{strategyId}});
 await prisma.strategyEvent.deleteMany({where:{strategyId}});
 await prisma.treasuryTransfer.deleteMany({where:{reference:"strategy_withdrawal:"+eventId}});
 if(originalDeposit!==null)await prisma.treasury.update({where:{kind:"DEPOSIT"},data:{amount:originalDeposit}});
 if(priorMint===undefined)delete process.env.BLOCKRADAR_SOLANA_USDC_MINT;else process.env.BLOCKRADAR_SOLANA_USDC_MINT=priorMint;
 if(positionId)await prisma.investorPosition.deleteMany({where:{id:positionId}});
 await prisma.strategy.deleteMany({where:{id:strategyId}});
 await prisma.$disconnect();
}
