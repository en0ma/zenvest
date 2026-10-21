import test from "node:test";
import assert from "node:assert/strict";
import {nextWithdrawalAttempt,masterCustodyCoversTreasury,MAX_WITHDRAWAL_ATTEMPTS} from "../src/lib/withdrawal-worker-rules.ts";
test("preflight retries are PENDING until the fifteenth, then FAILED",()=>{
 for(let current=0;current<MAX_WITHDRAWAL_ATTEMPTS;current++){
  const next=nextWithdrawalAttempt(current);
  assert.equal(next.attempts,current+1);
  assert.equal(next.onPreflightFailure,current===14?"FAILED":"PENDING");
 }
 for(const bad of [-1,15,16,1.1])assert.throws(()=>nextWithdrawalAttempt(bad));
});
test("Blockradar master USDC custody must cover deposit and deallocated principal",()=>{
 assert.equal(masterCustodyCoversTreasury(100_000_000n,70_000_000n,30_000_000n),true);
 assert.equal(masterCustodyCoversTreasury(99_999_999n,70_000_000n,30_000_000n),false);
 assert.equal(masterCustodyCoversTreasury(0n,0n,0n),true);
 assert.throws(()=>masterCustodyCoversTreasury(100n,-1n,0n));
});
