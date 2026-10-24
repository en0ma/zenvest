import test from "node:test";
import assert from "node:assert/strict";
import {masterCustodyCoversTreasury} from "../src/lib/withdrawal-worker-rules.ts";
import {reviewExpiryCutoff,REVIEW_TIMEOUT_MS} from "../src/lib/withdrawal-review-timeout.ts";

test("custody requires sufficient funds for both treasury liabilities",()=>{
 assert.equal(masterCustodyCoversTreasury(15000000n,10000000n,5000000n),true);
 assert.equal(masterCustodyCoversTreasury(14999999n,10000000n,5000000n),false);
 assert.equal(masterCustodyCoversTreasury(10000000n,10000000n,0n),true);
 assert.equal(masterCustodyCoversTreasury(0n,0n,0n),true);
});
test("custody uses bigint exactly above safe JavaScript integer range",()=>{
 const large=9007199254740993000000n;
 assert.equal(masterCustodyCoversTreasury(large+7n,large,7n),true);
 assert.equal(masterCustodyCoversTreasury(large+6n,large,7n),false);
});
test("negative onchain funds are rejected rather than treated as insufficiency",()=>{
 assert.throws(()=>masterCustodyCoversTreasury(-1n,0n,0n),/Invalid custody balances/);
});
test("negative deposit liability is rejected",()=>{
 assert.throws(()=>masterCustodyCoversTreasury(10n,-1n,0n),/Invalid custody balances/);
});
test("negative deallocation liability is rejected",()=>{
 assert.throws(()=>masterCustodyCoversTreasury(10n,0n,-1n),/Invalid custody balances/);
});
test("REVIEW timeout is exactly two hours based on supplied clock",()=>{
 const now=new Date("2026-01-01T00:00:00.000Z");
 assert.equal(REVIEW_TIMEOUT_MS,7200000);
 assert.equal(reviewExpiryCutoff(now).toISOString(),"2025-12-31T22:00:00.000Z");
 assert.equal(now.toISOString(),"2026-01-01T00:00:00.000Z","helper must not mutate time source");
});
test("REVIEW cutoff rejects invalid time",()=>{
 assert.throws(()=>reviewExpiryCutoff(new Date(NaN)),/Invalid current time/);
});
