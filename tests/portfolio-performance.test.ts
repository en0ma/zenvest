import assert from "node:assert/strict";
import test from "node:test";
import {reconstructPortfolioPerformance} from "../src/lib/portfolio-performance.ts";
const at=(s:string)=>new Date(s);
test("cash flows are excluded from settled-equity TWR and simple ratio",()=>{
 const events=[
  {id:"a",kind:"DEPOSIT" as const,at:at("2026-01-01T00:00:00Z"),amountMicros:1_000_000_000n},
  {id:"b",kind:"PNL" as const,at:at("2026-01-01T01:00:00Z"),amountMicros:50_000_000n},
  {id:"c",kind:"DEPOSIT" as const,at:at("2026-01-01T02:00:00Z"),amountMicros:1_000_000_000n},
  {id:"d",kind:"PNL" as const,at:at("2026-01-01T03:00:00Z"),amountMicros:41_000_000n},
 ];
 const result=reconstructPortfolioPerformance(2_091_000_000n,events);
 assert.equal(result.completeHistory,true);
 assert.ok(Math.abs(result.twrPercent!-7.1)<1e-9);
 assert.ok(Math.abs(result.simplePnlPercent!-4.55)<1e-9);
 assert.equal(result.points.at(-1)?.valueMicros,"2091000000");
});
test("missing balance history does not fabricate returns",()=>{
 const result=reconstructPortfolioPerformance(1_000_000n,[]);
 assert.equal(result.completeHistory,false);
 assert.equal(result.twrPercent,null);
 assert.equal(result.simplePnlPercent,null);
});
test("withdrawals are external flows, not negative P&L",()=>{
 const result=reconstructPortfolioPerformance(900_000_000n,[
  {id:"a",kind:"DEPOSIT",at:at("2026-01-01T00:00:00Z"),amountMicros:1_000_000_000n},
  {id:"b",kind:"WITHDRAWAL",at:at("2026-01-02T00:00:00Z"),amountMicros:-100_000_000n},
 ]);
 assert.equal(result.completeHistory,true);
 assert.equal(result.twrPercent,0);
});

test("zero opening balance with no records stays neutral, never fabricates a percentage",()=>{
 const result=reconstructPortfolioPerformance(0n,[]);
 assert.equal(result.completeHistory,true);
 assert.equal(result.twrPercent,0);
 assert.equal(result.simplePnlPercent,null);
 assert.deepEqual(result.points,[]);
});
test("same-timestamp events are ordered by ID independently of input order",()=>{
 const deposit={id:"a",kind:"DEPOSIT" as const,at:at("2026-01-01T00:00:00Z"),amountMicros:100n};
 const profit={id:"b",kind:"PNL" as const,at:at("2026-01-01T00:00:00Z"),amountMicros:10n};
 const one=reconstructPortfolioPerformance(110n,[profit,deposit]);
 const two=reconstructPortfolioPerformance(110n,[deposit,profit]);
 assert.deepEqual(one,two);
 assert.ok(one.twrPercent!==null&&Math.abs(one.twrPercent-10)<1e-9);
});
test("zero trading P&L at zero equity is permitted, but positive profit is rejected",()=>{
 const zero=reconstructPortfolioPerformance(0n,[{id:"a",kind:"PNL",at:at("2026-01-01T00:00:00Z"),amountMicros:0n}]);
 assert.equal(zero.twrPercent,0);
 const impossible=reconstructPortfolioPerformance(10n,[{id:"a",kind:"PNL",at:at("2026-01-01T00:00:00Z"),amountMicros:10n}]);
 assert.equal(impossible.twrPercent,null);
});
test("rejects negative deposits and positive withdrawals even when totals reconcile",()=>{
 const invalidDeposit=reconstructPortfolioPerformance(-1n,[{id:"a",kind:"DEPOSIT",at:at("2026-01-01T00:00:00Z"),amountMicros:-1n}]);
 assert.equal(invalidDeposit.completeHistory,true);
 assert.equal(invalidDeposit.twrPercent,null);
 const invalidWithdrawal=reconstructPortfolioPerformance(1n,[{id:"a",kind:"WITHDRAWAL",at:at("2026-01-01T00:00:00Z"),amountMicros:1n}]);
 assert.equal(invalidWithdrawal.twrPercent,null);
});
test("rejects impossible losses larger than invested equity",()=>{
 const events=[
  {id:"a",kind:"DEPOSIT" as const,at:at("2026-01-01T00:00:00Z"),amountMicros:100n},
  {id:"b",kind:"PNL" as const,at:at("2026-01-01T01:00:00Z"),amountMicros:-120n},
  {id:"c",kind:"DEPOSIT" as const,at:at("2026-01-01T02:00:00Z"),amountMicros:100n},
 ];
 const result=reconstructPortfolioPerformance(80n,events);
 assert.equal(result.completeHistory,true);
 assert.equal(result.twrPercent,null);
});
test("a total loss is exactly minus 100 percent and not a negative equity",()=>{
 const result=reconstructPortfolioPerformance(0n,[
  {id:"a",kind:"DEPOSIT",at:at("2026-01-01T00:00:00Z"),amountMicros:100n},
  {id:"b",kind:"PNL",at:at("2026-01-01T01:00:00Z"),amountMicros:-100n},
 ]);
 assert.equal(result.twrPercent,-100);
 assert.equal(result.simplePnlPercent,-100);
});
