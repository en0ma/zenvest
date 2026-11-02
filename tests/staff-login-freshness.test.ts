import assert from "node:assert/strict";
import test from "node:test";
import {isFreshStaffLogin,STAFF_SENSITIVE_SESSION_MAX_AGE_MS} from "../src/lib/staff-login-freshness.ts";
const now=1_800_000_000_000;
test("fresh staff login accepts verified 15-minute session boundary",()=>{
 assert.equal(isFreshStaffLogin(now,now),true);
 assert.equal(isFreshStaffLogin(now-STAFF_SENSITIVE_SESSION_MAX_AGE_MS,now),true);
});
test("staff login gate rejects expired or future sessions",()=>{
 assert.equal(isFreshStaffLogin(now-STAFF_SENSITIVE_SESSION_MAX_AGE_MS-1,now),false);
 assert.equal(isFreshStaffLogin(now+1,now),false);
});
test("staff login gate fails closed when timestamp is missing or malformed",()=>{
 for(const value of [undefined,null,0/0,"1800000000000",Infinity,-Infinity])assert.equal(isFreshStaffLogin(value,now),false);
});
