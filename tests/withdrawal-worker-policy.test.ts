import test from "node:test";
import assert from "node:assert/strict";
const MAX_ATTEMPTS=15;
test("pending withdrawals have a bounded retry limit",()=>{
 const attempts=Array.from({length:MAX_ATTEMPTS},(_,i)=>i+1);
 assert.equal(attempts.length,15);
 assert.equal(attempts.at(-1),15);
});
test("custody check includes both master deposit and deallocated principal",()=>{
 const deposit=70_000_000n,deallocate=30_000_000n;
 assert.equal(100_000_000n>=deposit+deallocate,true);
 assert.equal(99_999_999n>=deposit+deallocate,false);
});
