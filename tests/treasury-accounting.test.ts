import test from "node:test";
import assert from "node:assert/strict";
import {withdrawalSplit,platformShareMicros,availablePlatformBank} from "../src/lib/treasury-accounting.ts";

test("withdrawal debit equals payout plus fee",()=>{
 assert.deepEqual(withdrawalSplit(102_000_000n,100_000_000n,2_000_000n),{gross:102_000_000n,net:100_000_000n,fee:2_000_000n});
 assert.deepEqual(withdrawalSplit(100n,100n,0n),{gross:100n,net:100n,fee:0n});
 for(const [gross,net,fee] of [[102n,101n,2n],[0n,0n,0n],[100n,100n,-1n],[2n,0n,2n]])
  assert.throws(()=>withdrawalSplit(gross,net,fee));
});
test("platform share only accrues on strictly profitable events using exact micros",()=>{
 assert.equal(platformShareMicros(1_234_567n,250_000n),308_641n);
 assert.equal(platformShareMicros(500_000n,1_000_000n),500_000n);
 assert.equal(platformShareMicros(-4_000_000n,250_000n),0n);
 assert.equal(platformShareMicros(0n,250_000n),0n);
 assert.equal(platformShareMicros(100n,0n),0n);
 assert.throws(()=>platformShareMicros(100n,-1n));
 assert.throws(()=>platformShareMicros(100n,1_000_001n));
});
test("available Kalshi platform profit subtracts in-flight transfers without negative availability",()=>{
 assert.equal(availablePlatformBank(100n,35n),65n);
 assert.equal(availablePlatformBank(100n,100n),0n);
 assert.equal(availablePlatformBank(100n,120n),0n);
 assert.throws(()=>availablePlatformBank(-1n,0n));
 assert.throws(()=>availablePlatformBank(100n,-1n));
});
