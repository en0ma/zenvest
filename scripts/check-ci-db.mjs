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
  assert.deepEqual(rows.map(r=>r.enumlabel).sort(),['PENDING','SUBMITTING','PROCESSING','REVIEW','COMPLETED','FAILED','CANCELLED'].sort());
 }
 const schemaTables=await prisma.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
 const tableNames=new Set(schemaTables.map(x=>x.tablename));
 for(const name of ["users","deposits","user_wallets","withdrawals","positions","strategy_trades","strategies","treasuries","treasury_transactions"])assert.ok(tableNames.has(name),name);
 for(const obsolete of ["investor_portfolios","master_wallet_balances","bot_status","active_bot_trade","withdrawal_deallocations"])assert.ok(!tableNames.has(obsolete),obsolete);
 await assert.rejects(()=>prisma.treasury.create({data:{kind:"DEPOSIT",source:"MASTER_WALLET",amount:1n,walletAddress:"ci",walletId:"ci"}}),e=>e.code==="P2002");

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
  userId:user.id,positionId:"missing_position",amountUsdcMicros:1n,requestKey:"ci-missing-position"
 }}),e=>e.code==="P2003","allocation must reference an existing position");

 const withdrawal=await prisma.investorWithdrawal.create({data:{
  id:"ci_withdrawal_1",userId:user.id,amountUsdcMicros:100_000_000n,
  grossUsdcMicros:102_000_000n,feeUsdcMicros:2_000_000n,
  destinationAddress:"CI_DESTINATION_WALLET",idempotencyKey:"ci-request-1",status:"PENDING"
 }});
 assert.equal(withdrawal.attempts,0);
 assert.equal(withdrawal.nextRetry,null);
 const due=new Date("2026-10-22T18:00:00Z");
 const scheduled=await prisma.investorWithdrawal.update({where:{id:withdrawal.id},data:{attempts:1,nextRetry:due,status:"REVIEW"}});
 assert.equal(scheduled.attempts,1);
 assert.equal(scheduled.nextRetry?.getTime(),due.getTime());
 await prisma.investorWithdrawal.update({where:{id:withdrawal.id},data:{status:"PENDING",nextRetry:null}});
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
 console.log("CI PostgreSQL transaction rollback, uniqueness and idempotent settlement assertions passed");
 console.log("CI PostgreSQL migration, fixtures and uniqueness assertions passed");
}finally{await prisma.$disconnect();}
