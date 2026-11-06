import assert from "node:assert/strict";
import test from "node:test";
import {validateProposalPayload} from "../src/lib/staff-financial-limits.ts";
test("manual balance changes are categorically rejected",()=>{
 for(const payload of [{direction:"CREDIT",amountUsdcMicros:"1000000"},{direction:"DEBIT",amountUsdcMicros:"1"},{}])
  assert.deepEqual(validateProposalPayload("balances","adjust",payload,"100000000"),{ok:false,reason:"BALANCE_ADJUSTMENTS_NOT_ALLOWED"});
});
test("existing wallet transfer validation remains strict",()=>{
 assert.equal(validateProposalPayload("wallets","operate",{destination:"attacker"},"999","999").ok,false);
 assert.equal(validateProposalPayload("users","write",{},"999").ok,true);
});
