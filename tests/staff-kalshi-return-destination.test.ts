import assert from "node:assert/strict";
import test from "node:test";
import {resolveKalshiReturnDestination,validateAdminWalletTransfer} from "../src/lib/staff-wallet-policy.ts";
const master={source:"MASTER_WALLET",kind:"DEPOSIT",walletId:"master-id",walletAddress:"11111111111111111111111111111111",asset:"USDC",network:"solana"};
test("Kalshi returns can only resolve the registered master wallet destination",()=>{
 assert.equal(resolveKalshiReturnDestination(master,"master-id"),master.walletAddress);
 for(const changed of [{source:"KALSHI"},{kind:"M_BANK"},{walletId:"another"},{asset:"SOL"},{network:"ethereum"},{walletAddress:"not-an-address"}])
  assert.equal(resolveKalshiReturnDestination({...master,...changed},"master-id"),null);
 assert.equal(resolveKalshiReturnDestination(master,"different-configured-id"),null);
});
test("Kalshi proposal cannot include a destination, treasury source, or bucket override",()=>{
 const input={kind:"KALSHI_TO_MASTER",amountUsdcMicros:"1000000"};
 assert.equal(validateAdminWalletTransfer(input).ok,true);
 for(const mutation of [{destinationAddress:master.walletAddress},{source:"DEPOSIT"},{sourceBucket:"M_BANK"},{destinationBucket:"DEPOSIT"},{walletId:"another"}])
  assert.equal(validateAdminWalletTransfer({...input,...mutation}).ok,false);
});
