import assert from "node:assert/strict";
import test from "node:test";
import {canReviewAsRole,CONFIGURABLE_APPROVER_ROLES} from "../src/lib/staff-approval-policy.ts";
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
