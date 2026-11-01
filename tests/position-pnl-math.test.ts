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

test("financial fee rate validates precision, sign and maximum",()=>{
 for(const invalid of ["101","1.00001","-0.1","+1","1e2"," 1","1.",".5","NaN"]){
  assert.throws(()=>platformProfitFee(1000n,invalid),invalid);
 }
 assert.equal(platformProfitFee(123_456n,"0"),0n);
 assert.equal(platformProfitFee(123_456n,"100.0000"),123_456n);
 assert.equal(platformProfitFee(0n,"30.0000"),0n);
 assert.equal(platformProfitFee(-123_456n,"30.0000"),0n);
});
test("invalid negative investor weights cannot receive profits",()=>{
 assert.throws(()=>distributeWeightedMicros(3n,[{id:"a",eligibleCapitalUsdcMicros:-1n},{id:"b",eligibleCapitalUsdcMicros:2n}]));
});
