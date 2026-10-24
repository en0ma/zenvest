import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {validBlockradarSignature,parsePositiveUsdcMicros,validSweptDeposit} from "../src/lib/blockradar-event-validation.ts";
const master={id:"ci_master",address:"ci_master_sol_address"};
const mint="ci_sol_usdc_mint";
const recipient="ci_recipient";
function deposit(overrides:Record<string,unknown>={}):Record<string,unknown>{
 return {id:"ci_transaction",confirmed:true,status:"SUCCESS",type:"DEPOSIT",network:"devnet",
  amountPaid:"100.000001",asset:{symbol:"USDC",address:mint,decimals:6},wallet:master,
  assetSwept:true,assetSweptAmount:"100.000001",assetSweptHash:"ci_sweep_hash",
  assetSweptSenderAddress:recipient,assetSweptRecipientAddress:master.address,...overrides};
}
test("Blockradar signed raw webhook fixture validates HMAC-SHA512 and rejects tampering",()=>{
 const raw=JSON.stringify({event:"deposit.swept.success",data:deposit()});
 const key="ci-key";
 const signature=createHmac("sha512",key).update(raw).digest("hex");
 assert.equal(validBlockradarSignature(raw,signature,key),true);
 assert.equal(validBlockradarSignature(raw+" ",signature,key),false);
 assert.equal(validBlockradarSignature(raw,signature,"wrong-key"),false);
 assert.equal(validBlockradarSignature(raw,"bad",key),false);
 assert.equal(validBlockradarSignature(raw,null,key),false);
});
test("USDC micros parsing handles six decimal places and rejects unsafe/invalid inputs",()=>{
 assert.equal(parsePositiveUsdcMicros("100.000001"),100000001n);
 assert.equal(parsePositiveUsdcMicros("0.000001"),1n);
 for(const raw of ["0","-1","1.0000001","1e2"," 1","9223372036854.775808",3.4,null])
  assert.equal(parsePositiveUsdcMicros(raw),null,String(raw));
});
test("mock swept deposit must have exact authenticated custody evidence",()=>{
 const amount=100000001n;
 assert.equal(validSweptDeposit(deposit(),mint,master.id,recipient,amount),true);
 for(const bad of [
  {confirmed:false},{status:"PENDING"},{type:"WITHDRAW"},{network:"mainnet"},
  {asset:{symbol:"USDT",address:mint,decimals:6}},
  {asset:{symbol:"USDC",address:mint,decimals:18}},
  {wallet:{id:"foreign",address:master.address}},
  {assetSwept:false},{assetSweptAmount:"99.999999"},{assetSweptHash:""},
  {assetSweptSenderAddress:"wrong"},{assetSweptRecipientAddress:"foreign"},
 ]) assert.equal(validSweptDeposit(deposit(bad),mint,master.id,recipient,amount),false,JSON.stringify(bad));
});
