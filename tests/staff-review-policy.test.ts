import assert from "node:assert/strict";
import test from "node:test";
import {canReviewAction,validateActionTarget} from "../src/lib/staff-review-policy.ts";
const base={status:"PENDING" as const,requestedBy:"maker",actorId:"checker",hasPermission:true,isTwoFactorVerified:true,createdAt:new Date()};
test("independent authorized approver may decide pending actions",()=>assert.equal(canReviewAction(base),true));
test("same actor may not approve their own action",()=>assert.equal(canReviewAction({...base,actorId:"maker"}),false));
test("missing permission prevents approval",()=>assert.equal(canReviewAction({...base,hasPermission:false}),false));
test("missing second factor prevents approval",()=>assert.equal(canReviewAction({...base,isTwoFactorVerified:false}),false));
test("decided or executed actions cannot be reviewed again",()=>{
 for(const status of ["APPROVED","REJECTED","EXECUTED"] as const)assert.equal(canReviewAction({...base,status}),false);
});
test("financial request targets use an explicit allowlist",()=>{
 for(const [resource,operation] of [["users","write"],["deposits","reconcile"],["withdrawals","approve"],["balances","adjust"],["wallets","operate"]])assert.equal(validateActionTarget(resource,operation),true);
 for(const [resource,operation] of [["balances","write"],["wallets","delete"],["deposits","credit"],["users","make-super-admin"],["unknown","approve"]])assert.equal(validateActionTarget(resource,operation),false);
});

import {isWithinReviewWindow,REVIEW_WINDOW_MS} from "../src/lib/staff-review-policy.ts";
test("review window expires after 24 hours",()=>{
 const now=new Date("2026-11-02T12:00:00Z");
 assert.equal(isWithinReviewWindow(new Date(now.getTime()-REVIEW_WINDOW_MS),now),true);
 assert.equal(isWithinReviewWindow(new Date(now.getTime()-REVIEW_WINDOW_MS-1),now),false);
 assert.equal(isWithinReviewWindow(new Date(now.getTime()+1),now),false);
 assert.equal(canReviewAction({...base,createdAt:new Date(now.getTime()-REVIEW_WINDOW_MS-1),now}),false);
 assert.equal(canReviewAction({...base,createdAt:new Date(now.getTime()-60000),now}),true);
});
