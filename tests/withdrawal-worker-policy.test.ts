import test from "node:test";
import assert from "node:assert/strict";
import {masterCustodyCoversTreasury} from "../src/lib/withdrawal-worker-rules.ts";
test("Blockradar master USDC custody must cover deposit and deallocated principal",()=>{
 assert.equal(masterCustodyCoversTreasury(100_000_000n,70_000_000n,30_000_000n),true);
 assert.equal(masterCustodyCoversTreasury(99_999_999n,70_000_000n,30_000_000n),false);
 assert.equal(masterCustodyCoversTreasury(0n,0n,0n),true);
 assert.throws(()=>masterCustodyCoversTreasury(100n,-1n,0n));
});
