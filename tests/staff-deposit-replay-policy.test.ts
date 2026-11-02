import assert from "node:assert/strict";
import test from "node:test";
import {canReplayApprovedDeposit} from "../src/lib/staff-deposit-replay-policy.ts";
const valid={actionStatus:"APPROVED",resource:"deposits",operation:"reconcile",requestedBy:"maker",decidedBy:"checker",depositStatus:"CONFIRMING",creditedAt:null,providerTransactionId:"provider-transaction-1",masterWalletId:"master-wallet",expectedWalletId:"master-wallet",walletStatus:"ACTIVE",walletProvider:"BLOCKRADAR",walletNetwork:"solana"};
test("only independently approved uncredited deposit on matching master wallet is replayable",()=>assert.equal(canReplayApprovedDeposit(valid),true));
test("denies forged approvals and mismatched custody",()=>{
 for(const change of [{decidedBy:"maker"},{decidedBy:null},{actionStatus:"PENDING"},{resource:"withdrawals"},{operation:"adjust"},{depositStatus:"CONFIRMED"},{creditedAt:new Date()},{providerTransactionId:null},{expectedWalletId:"other-wallet"},{walletStatus:"ERROR"},{walletProvider:"OTHER"},{walletNetwork:"ethereum"}]){
  assert.equal(canReplayApprovedDeposit({...valid,...change}),false,JSON.stringify(change));
 }
});
