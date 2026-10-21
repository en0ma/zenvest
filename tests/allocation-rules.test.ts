import test from "node:test";
import assert from "node:assert/strict";
import {availableUnallocated,canRequestAllocation} from "../src/lib/allocation-rules.ts";
test("unallocated balance reserves pending payouts and allocations",()=>{
 assert.equal(availableUnallocated(100_000_000n,30_000_000n,20_000_000n),50_000_000n);
 assert.equal(availableUnallocated(20n,30n,0n),0n);
 assert.throws(()=>availableUnallocated(-1n,0n,0n));
 assert.throws(()=>availableUnallocated(100n,0n,-1n));
});
const standard={amount:20n,minimum:5n,maximum:50n,capacity:100n,pendingStrategy:40n,
 availableUser:60n,active:true,isPublic:true};
test("strategy allocation requires available user balance, capacity, active and public",()=>{
 assert.equal(canRequestAllocation(standard),true);
 for(const patch of [
  {amount:0n},{amount:4n},{amount:51n},{amount:61n},
  {availableUser:19n},{capacity:59n},{pendingStrategy:81n},
  {minimum:0n},{minimum:60n},{active:false},{isPublic:false},
 ])assert.equal(canRequestAllocation({...standard,...patch}),false,JSON.stringify(patch,(_,v)=>typeof v==="bigint"?v.toString():v));
 assert.equal(canRequestAllocation({...standard,amount:60n,maximum:60n,pendingStrategy:40n}),true);
});
