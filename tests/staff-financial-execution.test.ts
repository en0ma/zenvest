import assert from "node:assert/strict";
import test from "node:test";
import {FINANCIAL_EXECUTION_MODE,guardFinancialExecution} from "../src/lib/staff-financial-execution.ts";
const base={operation:"balances:adjust" as const,actionStatus:"APPROVED" as const,approvedBy:"checker",requestedBy:"maker",actorId:"executor",idempotencyKey:"unique-operation-123"};
test("all admin financial execution paths remain disabled",()=>{
 assert.equal(FINANCIAL_EXECUTION_MODE,"DISABLED");
 for(const operation of ["deposits:reconcile","withdrawals:approve","balances:adjust","wallets:operate"] as const){
  assert.deepEqual(guardFinancialExecution({...base,operation}),{allowed:false,reason:"FINANCIAL_EXECUTION_DISABLED"});
 }
});
test("guard rejects unapproved, self-approved and unidentified requests",()=>{
 assert.equal(guardFinancialExecution({...base,actionStatus:"PENDING"}).reason,"APPROVAL_REQUIRED");
 assert.equal(guardFinancialExecution({...base,approvedBy:"maker"}).reason,"INDEPENDENT_APPROVAL_REQUIRED");
 assert.equal(guardFinancialExecution({...base,idempotencyKey:""}).reason,"EXECUTION_IDENTITY_REQUIRED");
});
