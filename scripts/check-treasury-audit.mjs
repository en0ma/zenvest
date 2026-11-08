import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {registerHooks} from "node:module";
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="server-only")return nextResolve(new URL("./ci-server-only-shim.mjs",import.meta.url).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",import.meta.url).href,context);
 if(specifier.startsWith("./")&&context.parentURL?.includes("/src/lib/")&&!/\.[cm]?[jt]s$/.test(specifier))return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("Disposable CI database required");
const db=new PrismaClient();
const {runTreasuryAudit}=await import("../src/lib/treasury-audit.ts");
const id="caudittreasuryreview0000001";
const orphanRef="platform_kalshi_return:ci_audit_orphan";
const completedPlatformId="cauditplatformpayout00001";
const missingProfitTrade="ci_audit_profit_without_journal";
try{
 const before=await db.treasury.findMany({orderBy:{kind:"asc"}});
 const user=await db.user.findUniqueOrThrow({where:{id:"ci_test_user"}});
 const originalWithdrawals=await db.withdrawal.count();
 await db.withdrawal.create({data:{
  id,userId:user.id,amountUsdcMicros:5_000_000n,feeUsdcMicros:2_000_000n,
  grossUsdcMicros:7_000_000n,status:"REVIEW",failureCode:"PAYOUT_RESPONSE_UNKNOWN",
  destinationAddress:"11111111111111111111111111111111",
  createdAt:new Date("2000-01-01T00:00:00Z"),
  updatedAt:new Date("2000-01-01T00:00:00Z"),
 }});
 const master=await db.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
 await db.treasuryTransfer.create({data:{
  direction:"M_BANK_DEPOSIT",status:"COMPLETE",amountUsdcMicros:1000000n,
  destinationWalletAddress:master.walletAddress,masterWalletAddress:master.walletAddress,
  masterWalletId:master.walletId,reference:orphanRef,
  originExternalId:"ci-orphan-kalshi",destinationExternalId:"ci-orphan-master",completedAt:new Date(),
 }});
 await db.platformWithdrawal.create({data:{
  id:completedPlatformId,staffActionId:"ci_audit_platform_action",amountUsdcMicros:1000000n,
  reservedMBankMicros:1000000n,destinationAddress:"11111111111111111111111111111111",
  status:"COMPLETED",completedAt:new Date(),
 }});
 await db.strategyTrade.create({data:{
  id:missingProfitTrade,strategyId:"ci_test_strategy",marketTradeName:"Audit missing platform profit",
  marketTradeId:"ci_audit_missing_platform_profit",status:"SETTLED",isPnlCalculated:true,
  realizedPnlUsdcMicros:1000000n,eligibleCapitalUsdcMicros:1000000n,
  appliedPlatformProfitPercentage:"10.0000",settledAt:new Date(),
 }});
 await db.positionTradePnl.create({data:{
  strategyTradeId:missingProfitTrade,positionId:"ci_test_position",userId:user.id,
  eligibleCapitalUsdcMicros:1000000n,status:"SETTLED",grossPnlUsdcMicros:1000000n,
  platformFeeUsdcMicros:100000n,netPnlUsdcMicros:900000n,settledAt:new Date(),
 }});
 let calls=0;
 const today=new Date("2026-11-08T14:35:00.000Z");
 const check=await runTreasuryAudit({now:today,readCustody:async()=>{
  calls++;
  // Inject an independently observed balance different from accounting.
  const rows=await db.treasury.findMany();
  return rows.filter(r=>["DEPOSIT","DEPOSIT_FEE","WITHDRAWAL_FEE","M_BANK"].includes(r.kind))
   .reduce((n,r)=>n+r.amount,0n)+100_000_000n;
 }});
 assert.equal(calls,1);
 assert.equal(check.checkedAt,today.toISOString());
 assert.ok(check.findings.some(f=>f.code==="STALE_INVESTOR_WITHDRAWAL_REVIEW"&&f.sampleIds.includes(id)),
  "ancient unknown payout must be highlighted but never resolved automatically");
 assert.ok(check.findings.some(f=>f.code==="MASTER_CUSTODY_DIFFERENCE"),
  "external custody mismatch must be reported");
 for(const [code,sampleId] of [
  ["STAFF_RETURN_INBOUND_ORPHAN",orphanRef],
  ["COMPLETED_PLATFORM_PAYOUT_LEDGER_MISMATCH",completedPlatformId],
  ["SETTLED_PLATFORM_PROFIT_JOURNAL_MISSING",missingProfitTrade],
 ]){
  assert.ok(check.findings.some(f=>f.code===code&&(code==="STAFF_RETURN_INBOUND_ORPHAN"||f.sampleIds.includes(sampleId))),
   "audit should detect missing ledger counterpart: "+code);
 }
 assert.equal(check.custody.status,"mismatch");
 assert.ok(check.custody.observedMasterMicros!==null);
 assert.equal(check.findings.filter(f=>f.code==="MASTER_CUSTODY_LOOKUP_UNAVAILABLE").length,0);
 assert.equal((await db.withdrawal.findUniqueOrThrow({where:{id}})).status,"REVIEW");
 const noProvider=await runTreasuryAudit({now:today,readCustody:async()=>{throw Error("Mock provider outage");}});
 assert.equal(noProvider.complete,false);
 assert.equal(noProvider.custody.status,"unavailable");
 assert.ok(noProvider.findings.some(f=>f.code==="MASTER_CUSTODY_LOOKUP_UNAVAILABLE"),
  "unavailable provider must never be treated as a matched balance");
 assert.equal((await db.withdrawal.findUniqueOrThrow({where:{id}})).status,"REVIEW");
 assert.deepEqual(
  (await db.treasury.findMany({orderBy:{kind:"asc"}})).map(x=>[x.kind,x.amount]),
  before.map(x=>[x.kind,x.amount]),"audit must not change custody accounting");
 assert.equal(await db.withdrawal.count(),originalWithdrawals+1,"audit cannot change financial statuses");
 console.log("Read-only treasury audit PostgreSQL passed: stale holds, custody difference, provider outage, no balance/status changes");
}finally{
 await db.positionTradePnl.deleteMany({where:{strategyTradeId:missingProfitTrade}});
 await db.strategyTrade.deleteMany({where:{id:missingProfitTrade}});
 await db.platformWithdrawal.deleteMany({where:{id:completedPlatformId}});
 await db.treasuryTransfer.deleteMany({where:{reference:orphanRef}});
 await db.withdrawal.deleteMany({where:{id}});
 await db.$disconnect();
}
