import test from "node:test";
import assert from "node:assert/strict";
import {submitBlockradarPayout,withdrawalReference} from "../src/lib/blockradar-payout.ts";
const id="c1234567890abc",userId="ci-user",address="11111111111111111111111111111111";
const config={key:"mock",walletId:"master",assetId:"usdc-asset"};
// Response fields follow the documented Master Wallet withdrawal 200 response.\n// https://docs.blockradar.co/en/api-reference/withdraw/master-wallet\nfunction receipt(patch:Record<string,unknown>={}){
 return new Response(JSON.stringify({statusCode:200,message:"Withdrawal request initiated successfully",data:{id:"provider-id",status:"PENDING",type:"WITHDRAW",amount:"7.968750",recipientAddress:address,reference:withdrawalReference(id),metadata:{userId},wallet:{id:"master"},asset:{symbol:"USDC",decimals:6},...patch}}),{status:200});
}
test("payout uses withdrawal ID as reference, user ID metadata and exact USDC amount",async()=>{
 assert.equal(withdrawalReference(id),id);
 let calls=0;
 const mock:typeof fetch=async(url,init)=>{
  calls++;assert.equal(String(url),"https://api.blockradar.co/v1/wallets/master/withdraw");
  assert.equal(init?.method,"POST");
  assert.equal((init?.headers as Record<string,string>)["x-api-key"],"mock");
  assert.deepEqual(JSON.parse(String(init?.body)),{assetId:"usdc-asset",address,amount:"7.968750",reference:withdrawalReference(id),metadata:{userId}});
  return receipt();
 };
 assert.deepEqual(await submitBlockradarPayout({id,userId,address,amount:7968750n},config,mock),{id:"provider-id",hash:null});
 assert.equal(calls,1);
});
test("HTTP 200 means accepted for async webhook settlement even without a transaction id",async()=>{
 const result=await submitBlockradarPayout({id,userId,address,amount:7968750n},config,async()=>new Response(null,{status:200}));
 assert.deepEqual(result,{id:null,hash:null});
});
test("non-200 responses never transition to processing",async()=>{
 for(const status of [202,400,409,429,500]){
  await assert.rejects(()=>submitBlockradarPayout({id,userId,address,amount:7968750n},config,
   async()=>new Response("provider error",{status})));
 }
});

test("a thrown fetch / ambiguous provider timeout is never treated as acceptance",async()=>{
 let calls=0;
 await assert.rejects(()=>submitBlockradarPayout({id,userId,address,amount:7968750n},config,async()=>{
  calls++;throw new Error("socket disconnected after submission");
 }),/socket disconnected/);
 assert.equal(calls,1);
});
