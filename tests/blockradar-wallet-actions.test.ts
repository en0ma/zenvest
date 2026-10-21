import test from "node:test";
import assert from "node:assert/strict";
import {requestBlockradarWalletAction} from "../src/lib/blockradar-wallet-actions.ts";
const conf={key:"mock-key",walletId:"solana-wallet-id"};
test("deposit finder calls documented wallet-wide rescan with no hash",async()=>{
 let seen: {url:string;init:RequestInit}|undefined;
 const mock:typeof fetch=async(input,init)=>{seen={url:String(input),init:init!};return new Response(JSON.stringify({message:"Block rescan initiated successfully",statusCode:200}),{status:200});};
 await requestBlockradarWalletAction("rescan",conf,mock);
 assert.equal(seen?.url,"https://api.blockradar.co/v1/wallets/solana-wallet-id/rescan/blocks");
 assert.equal(seen?.init.method,"POST");
 assert.deepEqual(JSON.parse(String(seen?.init.body)),{});
 assert.equal((seen?.init.headers as Record<string,string>)["x-api-key"],"mock-key");
});
test("wallet-wide sweep never uses forceSweep or transactionId",async()=>{
 let url="",body="";
 const mock:typeof fetch=async(input,init)=>{url=String(input);body=String(init?.body);return new Response(JSON.stringify({message:"Sweep initiated successfully",statusCode:200}),{status:200});};
 await requestBlockradarWalletAction("sweep",conf,mock);
 assert.equal(url,"https://api.blockradar.co/v1/wallets/solana-wallet-id/sweep/assets");
 assert.deepEqual(JSON.parse(body),{});
});
test("provider transport errors and malformed acknowledgement fail closed",async()=>{
 for(const response of [new Response("{}",{status:429}),new Response(JSON.stringify({statusCode:400}),{status:200}),new Response("not json",{status:200})]){
  await assert.rejects(()=>requestBlockradarWalletAction("sweep",conf,async()=>response));
 }
});
