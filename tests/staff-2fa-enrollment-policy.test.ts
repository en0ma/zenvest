import test from "node:test";
import assert from "node:assert/strict";
import {needsStaffTwoFactor} from "../src/lib/staff-2fa-enrollment-policy.ts";
test("baseline investor accounts keep optional 2FA",()=>{
 assert.equal(needsStaffTwoFactor(["user"],false),false);
 assert.equal(needsStaffTwoFactor([],false),false);
});
test("any additional staff role requires enrollment until 2FA is present",()=>{
 for(const key of ["support","finance","operations","auditor","risk-review","super-admin"]){
  assert.equal(needsStaffTwoFactor(["user",key],false),true,key);
  assert.equal(needsStaffTwoFactor(["user",key],true),false,key);
 }
});
