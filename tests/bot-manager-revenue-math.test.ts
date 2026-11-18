import test from "node:test";
import assert from "node:assert/strict";
import {previewBotStrategySplit} from "../src/lib/bot-manager-revenue-math.ts";
test("positive verified profit candidate split conserves exact micro-USDC",()=>{
 const result=previewBotStrategySplit(10_000_001n,2_000_000n,"30.0000","20.0000");
 assert.equal(result.managerCandidate,3_000_000n);
 assert.equal(result.platformCandidate,2_000_000n);
 assert.equal(result.investorCandidate,5_000_001n);
 assert.equal(result.existingInvestorNet,8_000_001n);
 assert.equal(result.existingPlatformFee,2_000_000n);
 assert.equal(result.managerCandidate+result.platformCandidate+result.investorCandidate,10_000_001n);
});
test("loss or break-even yields no positive candidate manager or platform revenue",()=>{
 for(const pnl of [-5_000_000n,0n]){
  const r=previewBotStrategySplit(pnl,0n,"30.0000","20.0000");
  assert.equal(r.managerCandidate,0n);
  assert.equal(r.platformCandidate,0n);
  assert.equal(r.investorCandidate,pnl);
 }
});
test("rejects overlapping fee percentages and inconsistent historical fees",()=>{
 assert.throws(()=>previewBotStrategySplit(100n,0n,"70","50"),/exceed 100/);
 assert.throws(()=>previewBotStrategySplit(100n,101n,"20","20"),/Invalid existing fee/);
 assert.throws(()=>previewBotStrategySplit(-10n,1n,"20","20"),/Invalid existing fee/);
 assert.throws(()=>previewBotStrategySplit(100n,-1n,"20","20"),/Invalid existing fee/);
 assert.throws(()=>previewBotStrategySplit(100n,0n,"20.12345","10"),/Invalid platform fee rate/);
});
