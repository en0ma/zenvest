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
