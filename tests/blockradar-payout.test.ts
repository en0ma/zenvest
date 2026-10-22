import test from "node:test";
import assert from "node:assert/strict";
import {submitBlockradarPayout,withdrawalReference} from "../src/lib/blockradar-payout.ts";
const id="c1234567890abc",userId="ci-user",address="11111111111111111111111111111111";
const config={key:"mock",walletId:"master",assetId:"usdc-asset"};
function receipt(patch:Record<string,unknown>={}){
 return new Response(JSON.stringify({statusCode:200,data:{id:"provider-id",status:"PENDING",amount:"7.968750",recipientAddress:address,reference:withdrawalReference(id),metadata:{userId},...patch}}),{status:200});
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
test("malformed, mismatched or failed provider acknowledgements cannot be marked submitted",async()=>{
 for(const r of [
  receipt({reference:"another"}),receipt({recipientAddress:"other"}),receipt({amount:"1.0"}),
  receipt({id:null}),receipt({status:"FAILED"}),new Response("{}",{status:400}),new Response("invalid",{status:200})
 ]) await assert.rejects(()=>submitBlockradarPayout({id,userId,address,amount:7968750n},config,async()=>r));
});
