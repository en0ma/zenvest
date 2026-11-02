import assert from "node:assert/strict";
import test from "node:test";
import {STAFF_PERMISSIONS,APPROVAL_REQUIRED,DEFAULT_ROLE_GRANTS} from "../src/lib/staff-permissions.ts";
const known=new Set<string>(STAFF_PERMISSIONS);
test("staff permission catalogue is unique",()=>{assert.equal(known.size,STAFF_PERMISSIONS.length)});
test("role templates contain only declared permissions",()=>{
 for(const [role,permissions] of Object.entries(DEFAULT_ROLE_GRANTS)){
  assert.ok(permissions.length>0,role);
  for(const permission of permissions)assert.ok(known.has(permission),role+" grants invalid permission "+permission);
 }
});
test("sensitive financial actions are explicitly approval-gated",()=>{
 const gated=new Set<string>(APPROVAL_REQUIRED);
 for(const permission of ["users:write","deposits:reconcile","withdrawals:approve","balances:adjust","wallets:operate"]){
  assert.ok(gated.has(permission),"Missing approval gate "+permission);
 }
});
test("support and auditor cannot authorize financial writes",()=>{
 const financial=["deposits:reconcile","withdrawals:approve","balances:adjust","wallets:operate"];
 for(const role of ["support","auditor"] as const){
  const grants=new Set<string>(DEFAULT_ROLE_GRANTS[role]);
  for(const permission of financial)assert.ok(!grants.has(permission),role+" has "+permission);
 }
});
test("role management remains restricted to super-admin",()=>{
 for(const [role,grants] of Object.entries(DEFAULT_ROLE_GRANTS)){
  if(role!=="super-admin")assert.ok(!new Set<string>(grants).has("roles:manage"),role);
 }
});
