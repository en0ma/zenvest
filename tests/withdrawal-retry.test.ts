import test from "node:test";
import assert from "node:assert/strict";
import {REVIEW_TIMEOUT_MS,reviewExpiryCutoff} from "../src/lib/withdrawal-review-timeout.ts";
test("REVIEW expires exactly two hours after original created_at",()=>{
 const now=new Date("2026-10-22T20:00:00.000Z");
 const cutoff=reviewExpiryCutoff(now);
 assert.equal(cutoff.toISOString(),"2026-10-22T18:00:00.000Z");
 assert.equal(REVIEW_TIMEOUT_MS,7200000);
 const before=new Date("2026-10-22T17:59:59.999Z");
 const exactly=new Date("2026-10-22T18:00:00.000Z");
 const after=new Date("2026-10-22T18:00:00.001Z");
 assert.equal(before<=cutoff,true);
 assert.equal(exactly<=cutoff,true);
 assert.equal(after<=cutoff,false);
});
test("invalid clock is rejected",()=>{
 assert.throws(()=>reviewExpiryCutoff(new Date(NaN)));
});
