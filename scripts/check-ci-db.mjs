import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
const prisma=new PrismaClient();
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw new Error("Refusing to inspect non-CI database");
try {
 const user=await prisma.user.findUniqueOrThrow({where:{id:"ci_test_user"}});
 assert.equal(user.role,"USER");
 assert.equal(user.unallocated,123_000_000n);
 const position=await prisma.investorPosition.findUniqueOrThrow({where:{id:"ci_test_position"},include:{strategy:true}});
 assert.equal(position.strategy.name,"CI Test Strategy");
 assert.equal(position.principalUsdcMicros,25_000_000n);
 const buckets=await prisma.treasury.findMany({orderBy:{kind:"asc"}});
 assert.equal(buckets.length,7);
 assert.deepEqual(buckets.map(x=>x.kind).sort(),["ALLOCATE","DEALLOCATE","DEPOSIT","DEPOSIT_FEE","K_BANK","M_BANK","WITHDRAWAL_FEE"].sort());
 // Verify the real PostgreSQL enum values after migration.
 for(const name of ['WithdrawalStatus','PositionTransferStatus']){
  const rows=await prisma.$queryRawUnsafe('SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=$1',name);
  assert.deepEqual(rows.map(r=>r.enumlabel).sort(),[...['PENDING','SUBMITTING','PROCESSING','REVIEW','COMPLETED','FAILED','CANCELLED'],...(name==='PositionTransferStatus'?['CONFIRMING']:[])].sort());
 }
 const schemaTables=await prisma.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
 const tableNames=new Set(schemaTables.map(x=>x.tablename));
 for(const name of ["users","deposits","user_wallets","withdrawals","positions","position_events","strategy_events","strategy_trades","strategies","treasuries","treasury_transactions","webhook_dead_later"])assert.ok(tableNames.has(name),name);
 for(const obsolete of ["investor_portfolios","master_wallet_balances","bot_status","active_bot_trade","withdrawal_deallocations","position_allocations","position_deallocations"])assert.ok(!tableNames.has(obsolete),obsolete);
 await assert.rejects(()=>prisma.treasury.create({data:{kind:"DEPOSIT",source:"MASTER_WALLET",amount:1n,walletAddress:"ci",walletId:"ci"}}),e=>e.code==="P2002");

 // Additive strategy-event foundation: no transfer ledger exists before custody evidence.
 const staged=await prisma.strategyEvent.create({data:{
  kind:"ALLOCATE",amountUsdcMicros:7_000_000n,strategyId:"ci_test_strategy",
 }});
 assert.equal(staged.status,"PROCESSING");
 assert.equal(staged.sourceConfirmed,false);
 assert.equal(staged.destinationConfirmed,false);
 assert.equal(staged.treasuryTransactionId,null);
 await assert.rejects(()=>prisma.strategyEvent.create({data:{
  kind:"ALLOCATE",amountUsdcMicros:0n,strategyId:"ci_test_strategy",
 }}),e=>/strategy_events_amount_positive/.test(String(e)),"strategy event amount must be positive");
 await assert.rejects(()=>prisma.strategyEvent.update({where:{id:staged.id},data:{status:"COMPLETED"}}),e=>/strategy_events_completed_requires_both/.test(String(e)),"completed requires verified source and destination");
 await prisma.strategyEvent.update({where:{id:staged.id},data:{sourceConfirmed:true,status:"CONFIRMING"}});
 await assert.rejects(()=>prisma.strategyEvent.update({where:{id:staged.id},data:{status:"COMPLETED"}}),e=>/strategy_events_completed_requires_both/.test(String(e)),"source-only confirmation must not complete");
 await prisma.strategyEvent.update({where:{id:staged.id},data:{destinationConfirmed:true,status:"COMPLETED"}});
 assert.equal((await prisma.strategyEvent.findUniqueOrThrow({where:{id:staged.id}})).status,"COMPLETED");
 // All deallocation requests now persist to the same position_events table.
 const reduction=await prisma.positionAllocation.create({data:{
  userId:user.id,positionId:position.id,strategyId:position.strategyId,
  kind:"DEALLOCATE",amountUsdcMicros:1_000_000n,
  requestKey:"ci-unified-deallocation",status:"PENDING",
 }});
 assert.equal(reduction.kind,"DEALLOCATE");
 assert.equal(reduction.strategyEventId,null);
 assert.equal(await prisma.positionAllocation.count({where:{kind:"DEALLOCATE",userId:user.id}}),1);
 await assert.rejects(()=>prisma.positionAllocation.create({data:{
  userId:user.id,positionId:position.id,strategyId:position.strategyId,
  kind:"DEALLOCATE",amountUsdcMicros:1_000_000n,
  requestKey:"ci-unified-deallocation",
 }}),e=>e.code==="P2002","repeat deallocation request must not duplicate");
 // Real PostgreSQL uniqueness and ownership constraints.
 const strategy=await prisma.strategy.findUniqueOrThrow({where:{id:"ci_test_strategy"}});
 assert.equal(strategy.platformProfitPercentage.toString(),"0");
 await prisma.strategyTrade.create({data:{
  id:"ci_trade_1",strategyId:strategy.id,marketTradeId:"CI_15M_EVENT_1",
  marketTradeName:"CI Synthetic 15m Event",status:"ENDED",profit:"0.12345678",
  platformProfitShare:"0.03086419",settledAt:new Date("2026-01-01T00:15:00Z")
 }});
 await assert.rejects(()=>prisma.strategyTrade.create({data:{
  strategyId:strategy.id,marketTradeId:"CI_15M_EVENT_1",marketTradeName:"Duplicate Event"
 }}),e=>e.code==="P2002","same strategy may not repeat a market event");
 const trade=await prisma.strategyTrade.findUniqueOrThrow({where:{id:"ci_trade_1"}});
 assert.equal(trade.profit.toString(),"0.12345678");
 assert.equal(trade.platformProfitShare.toString(),"0.03086419");
 await assert.rejects(()=>prisma.positionAllocation.create({data:{
  userId:user.id,positionId:"missing_position",strategyId:"ci_test_strategy",amountUsdcMicros:1n,requestKey:"ci-missing-position"
 }}),e=>e.code==="P2003","allocation must reference an existing position");

 const withdrawal=await prisma.investorWithdrawal.create({data:{
  id:"ci_withdrawal_1",userId:user.id,amountUsdcMicros:100_000_000n,
  grossUsdcMicros:102_000_000n,feeUsdcMicros:2_000_000n,
  destinationAddress:"CI_DESTINATION_WALLET",idempotencyKey:"ci-request-1",status:"PENDING"
 }});
 await assert.rejects(()=>prisma.investorWithdrawal.create({data:{
  userId:user.id,amountUsdcMicros:100_000_000n,grossUsdcMicros:102_000_000n,
  destinationAddress:"CI_DESTINATION_WALLET",idempotencyKey:"ci-request-1"
 }}),e=>e.code==="P2002","withdrawal request key must be unique per user");

 const payout=await prisma.treasuryTransfer.create({data:{
  direction:"WITHDRAWAL",status:"PROCESSING",asset:"USDC",
  amountUsdcMicros:100_000_000n,feeUsdcMicros:2_000_000n,
  destinationWalletAddress:"CI_DESTINATION_WALLET",masterWalletAddress:"CI_MASTER",
  masterWalletId:"CI_TEST_WALLET",reference:"ci-payout-1"
 }});
 await assert.rejects(()=>prisma.treasuryTransfer.create({data:{
  direction:"WITHDRAWAL",status:"PROCESSING",amountUsdcMicros:100_000_000n,
  destinationWalletAddress:"CI_DESTINATION_WALLET",masterWalletAddress:"CI_MASTER",
  masterWalletId:"CI_TEST_WALLET",reference:"ci-payout-1"
 }}),e=>e.code==="P2002","treasury references must be globally unique");
 await prisma.investorWithdrawal.update({where:{id:withdrawal.id},data:{treasuryId:payout.id,status:"PROCESSING"}});
 
 // Test atomic rollback on an invalid balance movement. No partial user debit.
 const beforeUser=await prisma.user.findUniqueOrThrow({where:{id:user.id}});
 const beforeDeposit=await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
 await assert.rejects(()=>prisma.$transaction(async tx=>{
  await tx.user.update({where:{id:user.id},data:{unallocated:{decrement:102_000_000n}}});
  await tx.treasury.update({where:{kind:"DEPOSIT"},data:{amount:{decrement:102_000_000n}}});
  throw new Error("simulate settlement abort");
 }),/simulate settlement abort/);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).unallocated,beforeUser.unallocated);
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}})).amount,beforeDeposit.amount);

 // Conditional transition is an idempotency gate under PostgreSQL transactions.
 const settlement=async()=>prisma.$transaction(async tx=>{
  const claim=await tx.investorWithdrawal.updateMany({where:{id:withdrawal.id,status:"PROCESSING"},data:{status:"COMPLETED"}});
  if(claim.count===0)return false;
  const record=await tx.treasuryTransfer.updateMany({where:{id:payout.id,status:"PROCESSING"},data:{status:"COMPLETE"}});
  if(record.count!==1)throw new Error("missing matched payout ledger");
  const debited=await tx.user.updateMany({where:{id:user.id,unallocated:{gte:102_000_000n}},data:{unallocated:{decrement:102_000_000n}}});
  if(debited.count!==1)throw new Error("insufficient user funds");
  const bucket=await tx.treasury.updateMany({where:{kind:"DEPOSIT",amount:{gte:102_000_000n}},data:{amount:{decrement:102_000_000n}}});
  if(bucket.count!==1)throw new Error("insufficient deposit bucket");
  await tx.treasury.update({where:{kind:"WITHDRAWAL_FEE"},data:{amount:{increment:2_000_000n}}});
  return true;
 });
 assert.equal(await settlement(),true);
 assert.equal(await settlement(),false,"duplicate settlement must be a no-op");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).unallocated,21_000_000n);
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}})).amount,21_000_000n);
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"WITHDRAWAL_FEE"}})).amount,2_000_000n);
 assert.equal((await prisma.treasuryTransfer.findUniqueOrThrow({where:{id:payout.id}})).status,"COMPLETE");
 const archived=await prisma.webhookDeadLater.create({data:{
  kind:"withdrawal",userId:user.id,reference:withdrawal.id,providerTransactionId:"ci-provider-late-success",
  payload:{event:"withdraw.success",data:{reference:withdrawal.id,status:"SUCCESS"}},
 }});
 assert.equal(archived.kind,"withdrawal");
 assert.equal(archived.userId,user.id);
 assert.equal(archived.reference,withdrawal.id);
 assert.equal(archived.payload.event,"withdraw.success");
 await assert.rejects(()=>prisma.webhookDeadLater.create({data:{
  kind:"withdrawal",userId:user.id,reference:withdrawal.id,providerTransactionId:"ci-provider-late-success",
  payload:{event:"withdraw.success"},
 }}),e=>e.code==="P2002","duplicate late webhook must not create another archive");

 // Exercise the actual production withdrawal webhook handler against PostgreSQL.
 // Fields mirror Blockradar's documented transaction objects (id, status,
 // recipientAddress, reference, wallet, asset, amount, hash, type, network).
 // https://docs.blockradar.co/en/api-reference/transactions/get-transactions
 const mint="ci_solana_usdc_mint";
 process.env.BLOCKRADAR_SOLANA_USDC_MINT=mint;
 const {handleWithdrawalWebhook}=await import("../src/lib/withdrawal-webhook.ts");
 const recipient="11111111111111111111111111111111";
 const masterWalletId="CI_TEST_WALLET";
 async function makeWithdrawal(id,status){
  const tx=await prisma.treasuryTransfer.create({data:{
   direction:"WITHDRAWAL",status:status==="FAILED"?"FAILED":"PROCESSING",asset:"USDC",
   amountUsdcMicros:3_000_000n,feeUsdcMicros:2_000_000n,
   destinationWalletAddress:recipient,masterWalletAddress:"CI_MASTER",masterWalletId,
   reference:`withdrawal:${id}`,
  }});
  const w=await prisma.investorWithdrawal.create({data:{
   id,userId:user.id,amountUsdcMicros:3_000_000n,grossUsdcMicros:5_000_000n,
   feeUsdcMicros:2_000_000n,destinationAddress:recipient,
   idempotencyKey:id,status,treasuryId:tx.id,
  }});
  return {w,tx};
 }
 function mockWithdrawWebhook(id,transactionId,kind="success",patch={}){
  const status=kind==="success"?"SUCCESS":kind==="failed"?"FAILED":"CANCELLED";
  return {event:"withdraw."+kind,data:{
   id:transactionId,reference:`withdrawal:${id}`,amount:"3.000000",recipientAddress:recipient,
   wallet:{id:masterWalletId},type:"WITHDRAW",status,network:"testnet",
   asset:{address:mint,symbol:"USDC",decimals:6},hash:"ci_chain_hash_"+transactionId,
   confirmed:kind==="success",metadata:{userId:user.id},
   ...patch,
  }};
 }
 const review=await makeWithdrawal("c1234567890abcdef001","REVIEW");
 const balanceBefore=(await prisma.user.findUniqueOrThrow({where:{id:user.id}})).unallocated;
 const depositBefore=(await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}})).amount;
 const success=mockWithdrawWebhook(review.w.id,"ci_review_success");
 assert.equal(await handleWithdrawalWebhook(success.event,success.data,masterWalletId,success),"settled");
 assert.equal((await prisma.investorWithdrawal.findUniqueOrThrow({where:{id:review.w.id}})).status,"COMPLETED");
 assert.equal((await prisma.treasuryTransfer.findUniqueOrThrow({where:{id:review.tx.id}})).status,"COMPLETE");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).unallocated,balanceBefore-5_000_000n);
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}})).amount,depositBefore-5_000_000n);
 assert.equal(await handleWithdrawalWebhook(success.event,success.data,masterWalletId,success),"duplicate");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).unallocated,balanceBefore-5_000_000n);

 const late=await makeWithdrawal("c1234567890abcdef002","FAILED");
 const latePayload=mockWithdrawWebhook(late.w.id,"ci_late_success");
 const balanceBeforeLate=(await prisma.user.findUniqueOrThrow({where:{id:user.id}})).unallocated;
 assert.equal(await handleWithdrawalWebhook(latePayload.event,latePayload.data,masterWalletId,latePayload),"dead_letter");
 assert.equal(await handleWithdrawalWebhook(latePayload.event,latePayload.data,masterWalletId,latePayload),"dead_letter");
 const saved=await prisma.webhookDeadLater.findMany({where:{kind:"withdrawal",reference:late.w.id}});
 assert.equal(saved.length,1,"late successful webhook should be archived once");
 assert.equal(saved[0].userId,user.id);
 assert.deepEqual(saved[0].payload,latePayload);
 assert.equal((await prisma.investorWithdrawal.findUniqueOrThrow({where:{id:late.w.id}})).status,"FAILED");
 assert.equal((await prisma.treasuryTransfer.findUniqueOrThrow({where:{id:late.tx.id}})).status,"FAILED");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).unallocated,balanceBeforeLate);

 const invalid=await makeWithdrawal("c1234567890abcdef003","REVIEW");
 const tampered=mockWithdrawWebhook(invalid.w.id,"ci_invalid_success","success",{recipientAddress:"other"});
 assert.equal(await handleWithdrawalWebhook(tampered.event,tampered.data,masterWalletId,tampered),"mismatch");
 assert.equal((await prisma.investorWithdrawal.findUniqueOrThrow({where:{id:invalid.w.id}})).status,"REVIEW");
 const failed=mockWithdrawWebhook(invalid.w.id,"ci_failed","failed");
 assert.equal(await handleWithdrawalWebhook(failed.event,failed.data,masterWalletId,failed),"settled");
 assert.equal((await prisma.investorWithdrawal.findUniqueOrThrow({where:{id:invalid.w.id}})).status,"FAILED");
 assert.equal((await prisma.treasuryTransfer.findUniqueOrThrow({where:{id:invalid.tx.id}})).status,"FAILED");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).unallocated,balanceBeforeLate);
 console.log("Actual Blockradar-style webhook handler PostgreSQL success, duplicate, mismatch, failure, late-success archive checks passed");

 // Source-only allocation settlement: never credit a position or ALLOCATE bucket
 // until independently verified Kalshi destination receipt is implemented.
 const {handleAllocationWebhook}=await import("../src/lib/allocation-webhook.ts");
 const strategyWallet="11111111111111111111111111111111";
 await prisma.strategy.update({where:{id:strategy.id},data:{kalshiWalletAddress:strategyWallet,availableCapacityUsdcMicros:100_000_000n}});
 const evt=await prisma.strategyEvent.create({data:{
  kind:"ALLOCATE",strategyId:strategy.id,amountUsdcMicros:7_000_000n,
 }});
 const children=[];
 for(const [i,n] of [3_000_000n,4_000_000n].entries()){
  const pos=await prisma.investorPosition.create({data:{userId:user.id,strategyId:strategy.id}});
  const operation=await prisma.positionAllocation.create({data:{
   userId:user.id,positionId:pos.id,strategyId:strategy.id,kind:"ALLOCATE",
   strategyEventId:evt.id,status:"PROCESSING",amountUsdcMicros:n,
   requestKey:"ci-batch-"+i,
  }});
  children.push({pos,operation});
 }
 const reference="strategy_withdrawal:"+evt.id;
 const data={id:"ci-blockradar-source",reference,status:"SUCCESS",type:"WITHDRAW",amount:"7.000000",
  recipientAddress:strategyWallet,network:"testnet",wallet:{id:masterWalletId},
  asset:{address:mint,symbol:"USDC",decimals:6},hash:"ci-source-hash",confirmed:true};
 const balanceBeforeSource=(await prisma.user.findUniqueOrThrow({where:{id:user.id}})).unallocated;
 const depositBeforeSource=(await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}})).amount;
 const allocatedBeforeSource=(await prisma.treasury.findUniqueOrThrow({where:{kind:"ALLOCATE"}})).amount;
 assert.equal(await handleAllocationWebhook("withdraw.success",data,masterWalletId),"awaiting_kalshi_receipt");
 assert.equal(await handleAllocationWebhook("withdraw.success",data,masterWalletId),"duplicate");
 const source=(await prisma.strategyEvent.findUniqueOrThrow({where:{id:evt.id}}));
 assert.equal(source.sourceConfirmed,true);
 assert.equal(source.destinationConfirmed,false);
 assert.equal(source.status,"CONFIRMING");
 assert.ok(source.treasuryTransactionId);
 const transfer=await prisma.treasuryTransfer.findUniqueOrThrow({where:{id:source.treasuryTransactionId}});
 assert.equal(transfer.reference,reference);
 assert.equal(transfer.originExternalId,data.id);
 assert.equal(transfer.destinationExternalId,null);
 assert.equal(transfer.status,"PROCESSING");
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}})).amount,depositBeforeSource-7_000_000n);
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"ALLOCATE"}})).amount,allocatedBeforeSource);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).unallocated,balanceBeforeSource);
 for(const {pos,operation} of children){
  assert.equal((await prisma.positionAllocation.findUniqueOrThrow({where:{id:operation.id}})).status,"CONFIRMING");
  assert.equal((await prisma.investorPosition.findUniqueOrThrow({where:{id:pos.id}})).principalUsdcMicros,0n);
 }
 assert.equal(await handleAllocationWebhook("withdraw.failed",{...data,status:"FAILED"},masterWalletId),"requires_reconciliation");
 assert.equal(await handleAllocationWebhook("withdraw.success",{...data,id:"wrong-provider"},masterWalletId),"mismatch");
 // The domain service accepts only evidence independently verified by a
 // future Kalshi adapter. No provider transport is mocked as authenticated.
 const {settleVerifiedStrategyFunding}=await import("../src/lib/strategy-funding-settlement.ts");
 const verified={strategyEventId:evt.id,kalshiTransactionId:"ci-kalshi-credit-1",
  strategyWalletAddress:strategyWallet,amountUsdcMicros:7_000_000n,
  asset:"USDC",network:"solana"};
 assert.equal(await settleVerifiedStrategyFunding({...verified,amountUsdcMicros:8_000_000n}),"mismatch");
 assert.equal((await prisma.strategyEvent.findUniqueOrThrow({where:{id:evt.id}})).destinationConfirmed,false);
 assert.equal(await settleVerifiedStrategyFunding(verified),"settled");
 assert.equal(await settleVerifiedStrategyFunding(verified),"duplicate");
 assert.equal(await settleVerifiedStrategyFunding({...verified,kalshiTransactionId:"different"}),"mismatch");
 const finalized=await prisma.strategyEvent.findUniqueOrThrow({where:{id:evt.id}});
 assert.equal(finalized.sourceConfirmed,true);
 assert.equal(finalized.destinationConfirmed,true);
 assert.equal(finalized.status,"COMPLETED");
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"ALLOCATE"}})).amount,allocatedBeforeSource+7_000_000n);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).unallocated,balanceBeforeSource-7_000_000n);
 assert.equal((await prisma.treasuryTransfer.findUniqueOrThrow({where:{id:source.treasuryTransactionId}})).destinationExternalId,verified.kalshiTransactionId);
 for(const {pos,operation} of children){
  assert.equal((await prisma.positionAllocation.findUniqueOrThrow({where:{id:operation.id}})).status,"COMPLETED");
  assert.equal((await prisma.investorPosition.findUniqueOrThrow({where:{id:pos.id}})).principalUsdcMicros,operation.amountUsdcMicros);
 }
 console.log("Strategy source-only confirmation, duplicate, mismatch, and financial conservation passed");
 console.log("CI PostgreSQL transaction rollback, uniqueness and idempotent settlement assertions passed");
 console.log("CI PostgreSQL migration, fixtures and uniqueness assertions passed");
}finally{await prisma.$disconnect();}
