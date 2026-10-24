import test from "node:test";
import assert from "node:assert/strict";
import {submitBlockradarAllocation} from "../src/lib/blockradar-allocation.ts";
import {submitBlockradarPayout} from "../src/lib/blockradar-payout.ts";
import {readBlockradarUsdcBalance} from "../src/lib/blockradar-master-balance.ts";
const cfg={key:"ci-key",walletId:"ci-wallet",assetId:"ci-usdc"};
const ok=(body:unknown)=>new Response(JSON.stringify(body),{status:200});
const input={reference:"strategy_withdrawal:ci-event",strategyId:"ci-strategy",
 address:"11111111111111111111111111111111",amount:1234567n};

test("allocation provider submits exact USDC micros and immutable event reference",async()=>{
 let calls=0;
 const send:typeof fetch=async(url,opts)=>{
  calls++;
  assert.match(String(url),/ci-wallet\/withdraw$/);
  assert.equal(opts?.method,"POST");
  assert.equal((opts?.headers as Record<string,string>)["x-api-key"],cfg.key);
  const body=JSON.parse(String(opts?.body));
  assert.equal(body.amount,"1.234567");
  assert.equal(body.assetId,cfg.assetId);
  assert.equal(body.reference,input.reference);
  assert.deepEqual(body.metadata,{strategyId:input.strategyId,kind:"allocation"});
  return ok({data:{id:"provider-allocation",hash:"hash-1"}});
 };
 assert.deepEqual(await submitBlockradarAllocation(input,cfg,send),{id:"provider-allocation",hash:"hash-1"});
 assert.equal(calls,1);
});
test("allocation rejects zero amount without a network transfer",async()=>{
 let calls=0;
 const send:typeof fetch=async()=>{calls++;throw Error("must not execute");};
 await assert.rejects(()=>submitBlockradarAllocation({...input,amount:0n},cfg,send),/positive/);
 assert.equal(calls,0);
});
test("allocation provider refusal and timeout remain errors, not paid acknowledgements",async()=>{
 await assert.rejects(()=>submitBlockradarAllocation(input,cfg,async()=>new Response("",{status:503})),/not accepted/);
 await assert.rejects(()=>submitBlockradarAllocation(input,cfg,async()=>{throw Error("network timeout")}),/network timeout/);
});
test("allocation acknowledgment without parseable receipt does not invent identifiers",async()=>{
 assert.deepEqual(await submitBlockradarAllocation(input,cfg,async()=>new Response("not-json",{status:200})),{id:null,hash:null});
});
test("withdrawal provider carries exact amount and stable withdrawal reference",async()=>{
 const receipt=await submitBlockradarPayout({id:"ci-w-01",userId:"ci-user",address:input.address,amount:2500001n},cfg,
 async(url,opts)=>{
  assert.match(String(url),/ci-wallet\/withdraw$/);
  const data=JSON.parse(String(opts?.body));
  assert.equal(data.amount,"2.500001");
  assert.equal(data.reference,"withdrawal:ci-w-01");
  assert.deepEqual(data.metadata,{userId:"ci-user"});
  return ok({data:{id:"payout-1",hash:"payout-hash"}});
 });
 assert.deepEqual(receipt,{id:"payout-1",hash:"payout-hash"});
});
test("withdrawal provider rejection and timeout never masquerade as submission",async()=>{
 const payout={id:"ci-w",userId:"ci-u",address:input.address,amount:1000000n};
 await assert.rejects(()=>submitBlockradarPayout(payout,cfg,async()=>new Response("",{status:500})),/did not accept/);
 await assert.rejects(()=>submitBlockradarPayout(payout,cfg,async()=>{throw Error("timeout")}),/timeout/);
});
test("withdrawal HTTP acknowledgment is not final settlement",async()=>{
 const receipt=await submitBlockradarPayout({id:"ci-w",userId:"ci-u",address:input.address,amount:1000000n},cfg,
 async()=>ok({data:{}}));
 assert.deepEqual(receipt,{id:null,hash:null});
});
test("onchain balance must use confirmed USDC-denominated balance only",async()=>{
 const balance=await readBlockradarUsdcBalance(cfg,async(url,opts)=>{
  assert.equal(new URL(String(url)).searchParams.get("assetId"),cfg.assetId);
  assert.equal((opts?.headers as Record<string,string>)["x-api-key"],cfg.key);
  return ok({statusCode:200,data:{asset:{symbol:"USDC"},balance:"1234.000001"}});
 });
 assert.equal(balance,1234000001n);
});
test("onchain balance refuses provider errors, wrong assets and ambiguous totals",async()=>{
 await assert.rejects(()=>readBlockradarUsdcBalance(cfg,async()=>new Response("",{status:503})),/balance request failed/);
 await assert.rejects(()=>readBlockradarUsdcBalance(cfg,async()=>ok({statusCode:200,data:{asset:{symbol:"SOL"},balance:"5"}})),/Unexpected/);
 await assert.rejects(()=>readBlockradarUsdcBalance(cfg,async()=>ok({statusCode:200,data:{totalBalance:"100"}})),/Missing positive/);
 await assert.rejects(()=>readBlockradarUsdcBalance(cfg,async()=>ok({statusCode:500,data:{balance:"10"}})),/Missing master/);
});
