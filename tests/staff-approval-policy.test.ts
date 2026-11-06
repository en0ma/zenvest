import assert from "node:assert/strict";
import test from "node:test";
import {canReviewAsRole,isApprovedActionAuthorized,CONFIGURABLE_APPROVER_ROLES} from "../src/lib/staff-approval-policy.ts";
test("only Super Admin may review by default",()=>{
 assert.equal(canReviewAsRole(["super-admin"],[]),true);
 for(const role of ["user",...CONFIGURABLE_APPROVER_ROLES])
  assert.equal(canReviewAsRole([role],[]),false,role+" must not approve by default");
});
test("optional reviewer roles may be enabled but never baseline accounts",()=>{
 assert.equal(canReviewAsRole(["operations"],["operations"]),true);
 assert.equal(canReviewAsRole(["finance"],["operations"]),false);
 assert.equal(canReviewAsRole(["user"],["user"]),false);
 assert.equal(canReviewAsRole(["super-admin"],["operations"]),true);
});

test("self-authorized execution requires current Super Admin membership",()=>{
 const base={status:"APPROVED",requestedBy:"maker",decidedBy:"maker"};
 assert.equal(isApprovedActionAuthorized(base,true),true);
 assert.equal(isApprovedActionAuthorized(base,false),false);
 assert.equal(isApprovedActionAuthorized({...base,decidedBy:"checker"},false),true);
 assert.equal(isApprovedActionAuthorized({...base,status:"PENDING"},true),false);
 assert.equal(isApprovedActionAuthorized({...base,decidedBy:null},true),false);
});
