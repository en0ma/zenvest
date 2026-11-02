import assert from "node:assert/strict";
import test from "node:test";
import {classifyStaffDispatchResult} from "../src/lib/staff-withdrawal-dispatch-policy.ts";
test("only definitive pre-provider failure may rearm approved action",()=>{
 for(const s of ["preflight_retry","failed_validation"])assert.equal(classifyStaffDispatchResult(s),"SAFE_NO_PROVIDER_ATTEMPT");
});
test("concurrent claims and missing target are not safely retryable",()=>{
 for(const s of ["already_claimed","empty","review_pending","review_expired","already_settled","random_error"])assert.equal(classifyStaffDispatchResult(s),"REVIEW");
});
test("provider acceptance is never represented as confirmed settlement",()=>{
 assert.equal(classifyStaffDispatchResult("submitted"),"PROVIDER_ACCEPTED");
});
