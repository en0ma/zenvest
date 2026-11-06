import assert from "node:assert/strict";
import test from "node:test";
import {planAdminWalletFunding,validateAdminWalletTransfer,MASTER_WALLET_SPEND_KINDS,KALSHI_RETURN_SOURCE,KALSHI_RETURN_DESTINATION} from "../src/lib/staff-wallet-policy.ts";
const wallet="11111111111111111111111111111111";
const balances={M_BANK:5_000_000n,DEPOSIT_FEE:2_000_000n,WITHDRAWAL_FEE:3_000_000n,K_BANK:99_000_000n};
test("master can spend only platform bank plus two fee buckets",()=>{
 assert.deepEqual(MASTER_WALLET_SPEND_KINDS,["M_BANK","DEPOSIT_FEE","WITHDRAWAL_FEE"]);
 const plan=planAdminWalletFunding("MASTER_TO_WALLET",9_000_000n,balances);
 assert.equal(plan.ok,true);
 if(plan.ok){assert.deepEqual(plan.debits,{M_BANK:5_000_000n,DEPOSIT_FEE:2_000_000n,WITHDRAWAL_FEE:2_000_000n,K_BANK:0n});}
 assert.deepEqual(planAdminWalletFunding("MASTER_TO_WALLET",10_000_001n,balances),{ok:false,reason:"INSUFFICIENT_PLATFORM_FUNDS"});
});
test("master reserves outstanding platform transfers before spending",()=>{
 const plan=planAdminWalletFunding("MASTER_TO_WALLET",9_000_000n,balances,2_000_000n);
 assert.deepEqual(plan,{ok:false,reason:"INSUFFICIENT_PLATFORM_FUNDS"});
 assert.equal(planAdminWalletFunding("MASTER_TO_WALLET",8_000_000n,balances,2_000_000n).ok,true);
});
test("Kalshi returns use only K_BANK and cannot borrow master fee funds",()=>{
 assert.equal(KALSHI_RETURN_SOURCE,"K_BANK");assert.equal(KALSHI_RETURN_DESTINATION,"M_BANK");
 const plan=planAdminWalletFunding("KALSHI_TO_MASTER",90_000_000n,balances);
 assert.equal(plan.ok,true);
 if(plan.ok)assert.deepEqual(plan.debits,{M_BANK:0n,DEPOSIT_FEE:0n,WITHDRAWAL_FEE:0n,K_BANK:90_000_000n});
 assert.deepEqual(planAdminWalletFunding("KALSHI_TO_MASTER",100_000_000n,balances),{ok:false,reason:"INSUFFICIENT_K_BANK"});
});
test("invalid treasury state is always denied",()=>{
 assert.equal(planAdminWalletFunding("MASTER_TO_WALLET",1n,{...balances,DEPOSIT_FEE:-1n}).ok,false);
 assert.equal(planAdminWalletFunding("KALSHI_TO_MASTER",0n,balances).ok,false);
});
test("wallet transfer accepts positive integer micros without a configurable cap",()=>{
 const valid={kind:"MASTER_TO_WALLET",amountUsdcMicros:"1000000",destinationAddress:wallet};
 assert.equal(validateAdminWalletTransfer(valid).ok,true);
 assert.equal(validateAdminWalletTransfer({...valid,amountUsdcMicros:"100000000000000000"}).ok,true);
 assert.equal(validateAdminWalletTransfer({...valid,amountUsdcMicros:"1000000000000000000"}).ok,false);
 assert.equal(validateAdminWalletTransfer({...valid,amountUsdcMicros:"0"}).ok,false);
 assert.equal(validateAdminWalletTransfer({...valid,amountUsdcMicros:"1.5"}).ok,false);
 assert.equal(validateAdminWalletTransfer({...valid,source:"DEPOSIT"}).ok,false);
 assert.equal(validateAdminWalletTransfer({...valid,destinationAddress:"invalid"}).ok,false);
 assert.equal(validateAdminWalletTransfer({kind:"KALSHI_TO_MASTER",amountUsdcMicros:"1"}).ok,true);
 assert.equal(validateAdminWalletTransfer({kind:"KALSHI_TO_MASTER",amountUsdcMicros:"1",destinationAddress:wallet}).ok,false);
});
