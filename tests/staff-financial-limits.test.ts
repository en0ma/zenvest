import assert from "node:assert/strict";
import test from "node:test";
import {validateBalanceAdjustment,validateProposalPayload} from "../src/lib/staff-financial-limits.ts";
test("balance adjustments fail closed without configured limit",()=>{
 assert.deepEqual(validateBalanceAdjustment({direction:"CREDIT",amountUsdcMicros:"1000000"},undefined),{ok:false,reason:"ADJUSTMENTS_NOT_CONFIGURED"});
});
test("balance adjustments only accept exact bounded integer micros",()=>{
 const limit="5000000";
 assert.deepEqual(validateBalanceAdjustment({direction:"DEBIT",amountUsdcMicros:"5000000"},limit),{ok:true,payload:{direction:"DEBIT",amountUsdcMicros:"5000000"}});
 for(const amount of ["0","-1","1.5","1e3","0001","5000001","9999999999999999999"]){
  assert.equal(validateBalanceAdjustment({direction:"CREDIT",amountUsdcMicros:amount},limit).ok,false,amount);
 }
});
test("unknown adjustment attributes and direction are rejected",()=>{
 assert.equal(validateBalanceAdjustment({direction:"CREDIT",amountUsdcMicros:"1",override:true},"100").ok,false);
 assert.equal(validateBalanceAdjustment({direction:"TRANSFER",amountUsdcMicros:"1"},"100").ok,false);
});
test("non-balance proposals reject operation payload injection",()=>{
 assert.equal(validateProposalPayload("wallets","operate",{destination:"attacker"},"999","999").ok,false);
 assert.equal(validateProposalPayload("withdrawals","approve",{},"999").ok,true);
});
