import assert from "node:assert/strict";
import test from "node:test";
import {EDITABLE_ROLE_PERMISSIONS,isEditableRoleKey,validateRoleGrants} from "../src/lib/staff-role-editor-policy.ts";
test("only bounded non-reserved role keys are editable",()=>{
 for(const key of ["user","super-admin","A","a","a_b","a".repeat(41),""])assert.equal(isEditableRoleKey(key),false,key);
 for(const key of ["finance","operations","risk-review","read-only"])assert.equal(isEditableRoleKey(key),true,key);
});
test("role edits cannot grant super-admin management or retired investor-funds operations",()=>{
 for(const key of ["roles:manage","balances:adjust","deposits:reconcile","withdrawals:approve","account:access","portfolio:read:own"]){
  assert.equal(EDITABLE_ROLE_PERMISSIONS.includes(key as never),false,key);
  assert.equal(validateRoleGrants("risk-review",[key]),false,key);
 }
 assert.equal(validateRoleGrants("risk-review",["users:read","wallets:read"]),true);
 assert.equal(validateRoleGrants("risk-review",["users:read","users:read"]),false);
 assert.equal(validateRoleGrants("super-admin",[]),false);
 assert.equal(validateRoleGrants("user",[]),false);
});
