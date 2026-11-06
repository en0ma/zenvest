import assert from "node:assert/strict";
import test from "node:test";
import {STAFF_PERMISSIONS,STAFF_PERMISSION_DESCRIPTIONS} from "../src/lib/staff-permissions.ts";
import {EDITABLE_ROLE_PERMISSIONS} from "../src/lib/staff-role-editor-policy.ts";
test("every seeded permission has a unique human-readable description",()=>{
 assert.equal(new Set(STAFF_PERMISSIONS).size,STAFF_PERMISSIONS.length);
 assert.deepEqual(Object.keys(STAFF_PERMISSION_DESCRIPTIONS).sort(),[...STAFF_PERMISSIONS].sort());
 for(const key of STAFF_PERMISSIONS){
  const description=STAFF_PERMISSION_DESCRIPTIONS[key];
  assert.ok(description.trim().length>=20,key+" needs a meaningful description");
  assert.ok(description.length<=240,key+" description should be concise");
 }
});
test("editable permission descriptions explain supported operations only",()=>{
 for(const key of EDITABLE_ROLE_PERMISSIONS)assert.ok(STAFF_PERMISSION_DESCRIPTIONS[key]);
 assert.ok(STAFF_PERMISSION_DESCRIPTIONS["deposits:read"].includes("without manually"));
 assert.ok(STAFF_PERMISSION_DESCRIPTIONS["withdrawals:read"].includes("without dispatching"));
});
