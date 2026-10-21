import test from "node:test";
import assert from "node:assert/strict";
import {readBlockradarUsdcBalance} from "../src/lib/blockradar-master-balance.ts";
const config={key:"mock-key",walletId:"master-solana",assetId:"usdc-asset-uuid"};
test("master balance is queried for the exact Blockradar USDC asset",async()=>{
 const balance=await readBlockradarUsdcBalance(config,async(url,init)=>{
  assert.equal(String(url),"https://api.blockradar.co/v1/wallets/master-solana/balance?assetId=usdc-asset-uuid");
  assert.equal((init?.headers as Record<string,string>)["x-api-key"],"mock-key");
  return new Response(JSON.stringify({statusCode:200,data:{balance:"1234.012345"}}),{status:200});
 });
 assert.equal(balance,1234012345n);
});
test("missing, malformed or zero custody responses block payout",async()=>{
 for(const response of [
  new Response("{}",{status:503}),
  new Response(JSON.stringify({statusCode:200,data:{}}),{status:200}),
  new Response(JSON.stringify({statusCode:200,data:{balance:"0"}}),{status:200}),
  new Response(JSON.stringify({statusCode:200,data:{balance:"-5"}}),{status:200}),
  new Response(JSON.stringify({statusCode:200,data:{balance:"100",asset:"SOL"}}),{status:200}),
  new Response(JSON.stringify({statusCode:400,data:{balance:"100"}}),{status:200})
 ])await assert.rejects(()=>readBlockradarUsdcBalance(config,async()=>response));
});
