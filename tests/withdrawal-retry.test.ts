import test from "node:test";
import assert from "node:assert/strict";
import {scheduleWithdrawalRetry,MAX_WITHDRAWAL_ATTEMPTS} from "../src/lib/withdrawal-retry.ts";
test("ambiguous submission schedules 15, 30, 45, 60 minute backoff",()=>{
 const now=new Date("2026-10-22T12:00:00.000Z");
 for(let prior=0;prior<4;prior++){
  const result=scheduleWithdrawalRetry(prior,now);
  assert.equal(result.attempts,prior+1);
  assert.equal(result.nextRetry?.getTime(),now.getTime()+(prior+1)*15*60_000);
 }
});
test("fifth ambiguous reconciliation stops scheduling, never treats unknown transfer as confirmed failure",()=>{
 const result=scheduleWithdrawalRetry(4,new Date("2026-10-22T12:00:00Z"));
 assert.deepEqual(result,{attempts:5,nextRetry:null});
 assert.equal(MAX_WITHDRAWAL_ATTEMPTS,5);
 for(const n of [-1,5,6,0.5])assert.throws(()=>scheduleWithdrawalRetry(n,new Date()));
});
