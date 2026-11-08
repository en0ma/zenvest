import test from "node:test";
import assert from "node:assert/strict";
import {
 auditTreasuryBuckets,auditCompletedWithdrawal,auditStaffReturnPair,
 compareMasterCustody,expectedMasterMicros,
} from "../src/lib/treasury-audit-rules.ts";
const wallet="master-wallet";
const make=(kind:string,amount=10n)=>({
 kind,source:kind==="K_BANK"||kind==="ALLOCATE"?"KALSHI":"MASTER_WALLET",
 asset:"USDC",network:"solana",walletId:kind==="K_BANK"||kind==="ALLOCATE"?"kalshi-wallet":wallet,
 walletAddress:kind==="K_BANK"||kind==="ALLOCATE"?"kalshi-address":"master-address",amount,
});
const kinds=["DEPOSIT","ALLOCATE","DEPOSIT_FEE","WITHDRAWAL_FEE","M_BANK","K_BANK"];
test("six treasury buckets, identity, missing buckets, and invalid legacy kind",()=>{
 const rows=kinds.map(k=>make(k));
 assert.deepEqual(auditTreasuryBuckets(rows),[]);
 assert.equal(expectedMasterMicros(rows),40n);
 const issues=auditTreasuryBuckets([
  ...rows.filter(x=>x.kind!=="K_BANK"),
  {...make("DEPOSIT"),amount:-1n},
  {...make("WITHDRAWAL"),source:"MASTER_WALLET"},
  {...make("M_BANK"),walletId:"wrong"},
 ]);
 const codes=issues.map(x=>x.code);
 for(const code of ["MISSING_TREASURY_BUCKET","DUPLICATE_TREASURY_BUCKET","NEGATIVE_TREASURY_BALANCE",
                    "UNEXPECTED_TREASURY_BUCKET","MASTER_BUCKET_MISMATCH"])
  assert.ok(codes.includes(code),code);
});
test("master-wallet comparison is non-mutating and a mismatch is review-only",()=>{
 assert.deepEqual(compareMasterCustody(40n,40n,false),[]);
 const discrepancy=compareMasterCustody(40n,38n,true);
 assert.equal(discrepancy[0].code,"MASTER_CUSTODY_DIFFERENCE");
 assert.equal(discrepancy[0].severity,"warning");
 assert.match(discrepancy[0].detail,/transfers are in flight/);
 assert.equal(compareMasterCustody(-1n,0n,false)[0].severity,"critical");
});
test("completed withdrawal must match a single completed ledger record",()=>{
 const row={
  id:"cwithdrawalaudit1",status:"COMPLETED",grossUsdcMicros:7n,amountUsdcMicros:5n,feeUsdcMicros:2n,
  treasuryTransactionId:"t1",treasuryTransaction:{
   id:"t1",direction:"WITHDRAWAL",status:"COMPLETE",
   reference:"withdrawal:cwithdrawalaudit1",amountUsdcMicros:5n,feeUsdcMicros:2n,
  },
 };
 assert.deepEqual(auditCompletedWithdrawal(row),[]);
 assert.equal(auditCompletedWithdrawal({...row,treasuryTransaction:null})[0].code,"COMPLETED_WITHDRAWAL_LEDGER_MISSING");
 assert.equal(auditCompletedWithdrawal({...row,treasuryTransaction:{...row.treasuryTransaction,amountUsdcMicros:6n}})[0].code,
  "COMPLETED_WITHDRAWAL_LEDGER_MISMATCH");
 assert.deepEqual(auditCompletedWithdrawal({...row,status:"REVIEW"}),[]);
});
test("Kalshi->master paired ledgers require same amount and provider identities",()=>{
 const outbound={id:"out1",status:"COMPLETE",direction:"K_BANK_WITHDRAWAL",reference:"platform_kalshi_return:s1:k_bank_withdrawal",
 amountUsdcMicros:10n,originExternalId:"kalshi:1",destinationExternalId:"blockradar:1"};
 const inbound={...outbound,id:"in1",direction:"M_BANK_DEPOSIT",reference:"platform_kalshi_return:s1"};
 assert.deepEqual(auditStaffReturnPair(outbound,inbound),[]);
 assert.equal(auditStaffReturnPair(outbound,null)[0].code,"STAFF_RETURN_PAIR_MISMATCH");
 assert.equal(auditStaffReturnPair(outbound,{...inbound,amountUsdcMicros:9n})[0].code,"STAFF_RETURN_PAIR_MISMATCH");
});
