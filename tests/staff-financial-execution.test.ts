import assert from "node:assert/strict";
import test from "node:test";
import {FINANCIAL_EXECUTION_MODE,guardFinancialExecution} from "../src/lib/staff-financial-execution.ts";
const base={operation:"wallets:operate" as const,actionStatus:"APPROVED" as const,approvedBy:"checker",requestedBy:"maker",actorId:"executor",idempotencyKey:"unique-operation-123"};
test("all admin financial execution paths remain disabled",()=>{
 assert.equal(FINANCIAL_EXECUTION_MODE,"DISABLED");
 for(const operation of ["deposits:reconcile","withdrawals:approve","wallets:operate"] as const){
  assert.deepEqual(guardFinancialExecution({...base,operation}),{allowed:false,reason:"FINANCIAL_EXECUTION_DISABLED"});
 }
});
test("explicit withdrawal dispatch requires separate opt-in and independent approved action",()=>{
 assert.deepEqual(guardFinancialExecution({...base,operation:"withdrawals:approve"},true),{allowed:true,reason:"WITHDRAWAL_DISPATCH_ALLOWED"});
 assert.equal(guardFinancialExecution({...base,operation:"balances:adjust"},true).allowed,false);
 assert.equal(guardFinancialExecution({...base,operation:"withdrawals:approve",approvedBy:"maker"},true).allowed,false);
 assert.equal(guardFinancialExecution({...base,operation:"withdrawals:approve",actionStatus:"PENDING"},true).allowed,false);
});
test("guard rejects unapproved, self-approved and unidentified requests",()=>{
 assert.equal(guardFinancialExecution({...base,actionStatus:"PENDING"}).reason,"APPROVAL_REQUIRED");
 assert.equal(guardFinancialExecution({...base,approvedBy:"maker"}).reason,"INDEPENDENT_APPROVAL_REQUIRED");
 assert.equal(guardFinancialExecution({...base,idempotencyKey:""}).reason,"EXECUTION_IDENTITY_REQUIRED");
});
