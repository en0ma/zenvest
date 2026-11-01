import test from "node:test";
import assert from "node:assert/strict";
import {submitBlockradarAllocation} from "../src/lib/blockradar-allocation.ts";
const config={key:"mock-key",walletId:"master",assetId:"sol-usdc"};
const input={reference:"allocation:123e4567-e89b-12d3-a456-426614174000",
 strategyId:"ci_strategy",address:"11111111111111111111111111111111",amount:7_000_001n};
test("one Blockradar withdrawal represents summed strategy allocation batch",async()=>{
 let requests=0;
 const result=await submitBlockradarAllocation(input,config,async(url,init)=>{
  requests++;
  assert.equal(String(url),"https://api.blockradar.co/v1/wallets/master/withdraw");
  assert.equal(init?.method,"POST");
  assert.equal((init?.headers as Record<string,string>)["x-api-key"],config.key);
  assert.deepEqual(JSON.parse(String(init?.body)),{
   assetId:config.assetId,address:input.address,amount:"7.000001",
   reference:input.reference,metadata:{strategyId:input.strategyId,kind:"allocation"},
  });
  // Documented withdrawal response echoes transaction identifier and status.
  return new Response(JSON.stringify({statusCode:200,data:{
   id:"provider-id",status:"PENDING",type:"WITHDRAW",amount:"7.000001",
   recipientAddress:input.address,reference:input.reference,
   metadata:{strategyId:input.strategyId,kind:"allocation"},
  }}),{status:200});
 });
 assert.equal(requests,1);
 assert.deepEqual(result,{id:"provider-id",hash:null});
});
test("ambiguous API response must not be treated as accepted",async()=>{
 for(const status of [202,400,429,500]){
  await assert.rejects(()=>submitBlockradarAllocation(input,config,async()=>new Response("error",{status})));
 }
 await assert.rejects(()=>submitBlockradarAllocation(input,config,async()=>{throw new Error("Timeout");}),/Timeout/);
});
test("HTTP 200 can acknowledge asynchronous allocation without provider ID",async()=>{
 assert.deepEqual(await submitBlockradarAllocation(input,config,async()=>new Response(null,{status:200})),{id:null,hash:null});
});
