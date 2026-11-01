import assert from "node:assert/strict";
import test from "node:test";
import { distributeTradePnl } from "../src/lib/finance.ts";

const trade = (allocations: {investorId:string;allocatedKobo:bigint;effectiveAt:number}[], cutoffAt=100) => ({tradeId:"btc-15m-1",cutoffAt,allocations});

test("pro rata profit is exact with deterministic rounding",()=>{
  const result=distributeTradePnl(trade([{investorId:"b",allocatedKobo:1n,effectiveAt:1},{investorId:"a",allocatedKobo:1n,effectiveAt:1},{investorId:"c",allocatedKobo:1n,effectiveAt:1}]),2n);
  assert.equal(result.get("a"),1n);
  assert.equal(result.get("b"),1n);
  assert.equal(result.get("c"),0n);
  assert.equal([...result.values()].reduce((a,b)=>a+b,0n),2n);
});
test("losses distribute proportionally, exact total",()=>{
  const result=distributeTradePnl(trade([{investorId:"a",allocatedKobo:300n,effectiveAt:1},{investorId:"b",allocatedKobo:700n,effectiveAt:1}]),-101n);
  assert.equal(result.get("a"),-30n);
  assert.equal(result.get("b"),-71n);
});
test("late, zero, and unallocated funds never earn P&L",()=>{
  const result=distributeTradePnl(trade([{investorId:"a",allocatedKobo:500n,effectiveAt:100},{investorId:"late",allocatedKobo:900n,effectiveAt:101},{investorId:"zero",allocatedKobo:0n,effectiveAt:1}]),77n);
  assert.deepEqual([...result.entries()],[["a",77n]]);
});
test("zero trade result with no eligible capital is allowed",()=>{
  assert.equal(distributeTradePnl(trade([]),0n).size,0);
});
test("nonzero trade result with no eligible capital is refused",()=>{
  assert.throws(()=>distributeTradePnl(trade([]),1n),/without eligible/);
});
test("invalid snapshots and negative capital rejected",()=>{
  const good=[{investorId:"a",allocatedKobo:1n,effectiveAt:1}];
  assert.throws(()=>distributeTradePnl(trade([{...good[0],allocatedKobo:-1n}]),0n),/Invalid allocated/);
  assert.throws(()=>distributeTradePnl(trade([good[0],good[0]]),0n),/Duplicate/);
  assert.throws(()=>distributeTradePnl(trade(good,Number.NaN),1n),/Invalid trade cutoff/);
  assert.throws(()=>distributeTradePnl(trade([{...good[0],effectiveAt:1.5}]),1n),/Invalid allocation effective/);
  assert.throws(()=>distributeTradePnl({tradeId:" ",cutoffAt:100,allocations:good},1n),/Trade ID/);
});
test("huge bigint values are exact and input order independent",()=>{
  const a={investorId:"a",allocatedKobo:999999999999999999999999n,effectiveAt:1};
  const b={investorId:"b",allocatedKobo:999999999999999999999999n,effectiveAt:1};
  const x=distributeTradePnl(trade([a,b]),999999999999999999999n);
  const y=distributeTradePnl(trade([b,a]),999999999999999999999n);
  assert.deepEqual(Object.fromEntries(x),Object.fromEntries(y));
  assert.equal([...x.values()].reduce((sum,value)=>sum+value,0n),999999999999999999999n);
});
