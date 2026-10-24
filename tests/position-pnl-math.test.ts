import test from "node:test";
import assert from "node:assert/strict";
import {distributeWeightedMicros,platformProfitFee} from "../src/lib/position-pnl-math.ts";
test("conserves signed integer micros with stable remainders",()=>{
 const rows=[{id:"a",eligibleCapitalUsdcMicros:600n},{id:"b",eligibleCapitalUsdcMicros:300n},{id:"c",eligibleCapitalUsdcMicros:100n}];
 for(const amount of [0n,1n,2n,3n,100_000_003n,-1n,-2n,-3n,-100_000_003n]){
  const shares=distributeWeightedMicros(amount,rows);
  assert.equal([...shares.values()].reduce((n,x)=>n+x,0n),amount);
  assert.deepEqual(shares,distributeWeightedMicros(amount,[...rows].reverse()));
 }
 assert.deepEqual(distributeWeightedMicros(3n,[{id:"b",eligibleCapitalUsdcMicros:1n},{id:"a",eligibleCapitalUsdcMicros:1n}]),new Map([["a",2n],["b",1n]]));
});
test("charges platform fee only for positive market result",()=>{
 assert.equal(platformProfitFee(100_000_000n,"20.0000"),20_000_000n);
 assert.equal(platformProfitFee(-100_000_000n,"20"),0n);
 assert.equal(platformProfitFee(1n,"20"),0n);
 assert.equal(platformProfitFee(15n,"33.3333"),4n);
 assert.throws(()=>platformProfitFee(100n,"100.0001"));
 assert.throws(()=>platformProfitFee(100n,"-1"));
});
test("rejects zero or duplicate eligible capital",()=>{
 assert.throws(()=>distributeWeightedMicros(1n,[]));
 assert.throws(()=>distributeWeightedMicros(1n,[{id:"a",eligibleCapitalUsdcMicros:0n}]));
 assert.throws(()=>distributeWeightedMicros(1n,[{id:"a",eligibleCapitalUsdcMicros:1n},{id:"a",eligibleCapitalUsdcMicros:1n}]));
});
