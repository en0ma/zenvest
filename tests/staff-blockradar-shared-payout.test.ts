import assert from "node:assert/strict";
import test from "node:test";
import {submitBlockradarWithdrawal,platformWithdrawalReference} from "../src/lib/blockradar-payout.ts";
const config={key:"test",walletId:"master",assetId:"usdc"};
const address="11111111111111111111111111111111";
test("platform payouts reuse the exact investor Blockradar withdrawal HTTP endpoint",async()=>{
 const reference=platformWithdrawalReference("ci-platform-001");
 let calls=0;
 const receipt=await submitBlockradarWithdrawal({reference,address,amount:5000001n,metadata:{staffActionId:"ci-platform-001",source:"PLATFORM_TREASURY"}},config,async(url,init)=>{
  calls++;
  assert.equal(String(url),"https://api.blockradar.co/v1/wallets/master/withdraw");
  assert.deepEqual(JSON.parse(String(init?.body)),{assetId:"usdc",address,amount:"5.000001",reference,metadata:{staffActionId:"ci-platform-001",source:"PLATFORM_TREASURY"}});
  return Response.json({data:{id:"provider-accepted"}});
 });
 assert.equal(receipt.id,"provider-accepted");assert.equal(calls,1);
});
test("HTTP 200 is only asynchronous provider acceptance",async()=>{
 const receipt=await submitBlockradarWithdrawal({reference:platformWithdrawalReference("ci-platform-002"),address,amount:1000000n,metadata:{}},config,async()=>new Response(null,{status:200}));
 assert.deepEqual(receipt,{id:null,hash:null});
});
test("invalid reference or zero amount never touches provider",async()=>{
 let calls=0;
 const send:typeof fetch=async()=>{calls++;return Response.json({})};
 await assert.rejects(()=>submitBlockradarWithdrawal({reference:"withdrawal:bad",address,amount:1000000n,metadata:{}},config,send));
 await assert.rejects(()=>submitBlockradarWithdrawal({reference:platformWithdrawalReference("ci-platform-003"),address,amount:0n,metadata:{}},config,send));
 assert.equal(calls,0);
});
