import assert from "node:assert/strict";
import {registerHooks} from "node:module";

const shim=new URL("./ci-route-runtime-shim.mjs",import.meta.url).href;
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="next/server")return nextResolve(shim,context);
 if(specifier==="server-only")return nextResolve(new URL("./ci-server-only-shim.mjs",import.meta.url).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",import.meta.url).href,context);
 if(specifier.startsWith("./")&&context.parentURL?.includes("/src/lib/")&&!/\.[cm]?[jt]s$/.test(specifier))return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("Disposable CI database required");
const names=["CRON_SECRET","BLOCKRADAR_DEPOSITS_ENABLED","BLOCKRADAR_SOLANA_USDC_MINT","BLOCK_RADAR_API_KEY","BLOCK_RADAR_MASTER_WALLET_ID"];
const saved=Object.fromEntries(names.map(name=>[name,process.env[name]]));
const originalFetch=globalThis.fetch;
const {GET}=await import("../src/app/api/internal/reconcile-blockradar/route.ts");
const call=(auth=true)=>GET(new Request("https://ci.invalid/api/internal/reconcile-blockradar",{
 headers:auth?{authorization:"Bearer ci-reconcile-secret"}:{}
}));
const mint="ci-mint";
try{
 process.env.CRON_SECRET="ci-reconcile-secret";
 process.env.BLOCKRADAR_DEPOSITS_ENABLED="true";
 process.env.BLOCKRADAR_SOLANA_USDC_MINT=mint;
 process.env.BLOCK_RADAR_API_KEY="ci-provider-key";
 process.env.BLOCK_RADAR_MASTER_WALLET_ID="ci-provider-wallet";
 globalThis.fetch=async()=>{throw Error("Provider must not be called before config validation");};
 assert.equal((await call(false)).status,401);
 process.env.BLOCKRADAR_DEPOSITS_ENABLED="false";
 assert.equal((await call()).status,503);
 process.env.BLOCKRADAR_DEPOSITS_ENABLED="true";
 delete process.env.BLOCKRADAR_SOLANA_USDC_MINT;
 assert.equal((await call()).status,503);
 process.env.BLOCKRADAR_SOLANA_USDC_MINT=mint;
 delete process.env.BLOCK_RADAR_API_KEY;
 assert.equal((await call()).status,503);
 process.env.BLOCK_RADAR_API_KEY="ci-provider-key";

 let urls=[];
 globalThis.fetch=async(input,options)=>{
  urls.push(String(input));
  assert.equal(options.headers["x-api-key"],"ci-provider-key");
  assert.equal(options.cache,"no-store");
  return Response.json({data:[]});
 };
 let response=await call();
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{scanned:0,missing:0,replayRequested:0,complete:true,note:"Scanned all returned pages"});
 assert.equal(urls.length,1);
 assert.equal(new URL(urls[0]).searchParams.get("status"),"SUCCESS");
 assert.equal(new URL(urls[0]).searchParams.get("type"),"DEPOSIT");

 for(const handler of [
  async()=>new Response("error",{status:502}),
  async()=>Response.json({invalid:true}),
  async()=>Response.json({data:{unrecognized:[]}}),
  async()=>{throw new Error("network failure");},
 ]){
  globalThis.fetch=handler;
  response=await call();
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:"Reconciliation failed; retry required",scanned:0,missing:0,replayRequested:0,complete:false});
 }

 // Invalid transactions are excluded before wallet lookups and cannot request a replay.
 urls=[];
 const invalid=[
  null,{}, {status:"PENDING",type:"DEPOSIT",id:"ci-1"},
  {status:"SUCCESS",type:"WITHDRAWAL",id:"ci-2"},
  {status:"SUCCESS",type:"DEPOSIT",id:"ci-3",asset:{address:"wrong",symbol:"USDC"},recipientAddress:"unused"},
  {status:"SUCCESS",type:"DEPOSIT",id:"ci-4",asset:{address:mint,symbol:"USDT"},recipientAddress:"unused"},
  {status:"SUCCESS",type:"DEPOSIT",id:"ci-5",asset:{address:mint,symbol:"USDC"}}
 ];
 globalThis.fetch=async(input)=>{urls.push(String(input));return Response.json({data:{transactions:invalid}});};
 response=await call();
 assert.equal(response.status,200);
 assert.equal((await response.json()).replayRequested,0);
 assert.equal(urls.length,1);

 // A provider full-page sequence must stop at the five-page safety limit,
 // reporting incomplete reconciliation rather than claiming the wallet was fully scanned.
 urls=[];
 const full=Array.from({length:100},()=>({status:"PENDING",type:"DEPOSIT",id:"ignored"}));
 globalThis.fetch=async(input)=>{urls.push(String(input));return Response.json({data:full});};
 response=await call();
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{scanned:0,missing:0,replayRequested:0,complete:false,note:"Page limit reached; further backfill required"});
 assert.equal(urls.length,5);
 assert.deepEqual(urls.map(url=>new URL(url).searchParams.get("page")),["1","2","3","4","5"]);
 // Real PostgreSQL wallet and deposit lookups; only the provider transport is mocked.
 const {PrismaClient}=await import("@prisma/client");
 const db=new PrismaClient();
 const userId="ci_reconcile_user";
 const txId="ci-reconcile-already-recorded";
 const address="ci-reconcile-wallet-address";
 try{
  await db.user.create({data:{id:userId,email:"ci-reconcile@example.invalid",name:"CI Reconciliation",passwordHash:"ci-fixture"}});
  const wallet=await db.investorDepositWallet.create({data:{
   userId,masterWalletId:"ci-provider-wallet",address,status:"ACTIVE"
  }});
  const recognized=id=>({id,status:"SUCCESS",type:"DEPOSIT",asset:{address:mint,symbol:"USDC"},recipientAddress:address});
  const unknown=recognized("ci-missing-deposit");
  const recorded=recognized(txId);
  const unrelated={...recognized("ci-unrelated"),recipientAddress:"unregistered-wallet"};
  await db.blockchainDeposit.create({data:{
   walletId:wallet.id,providerTransactionId:txId,transactionHash:"ci-known-hash",
   assetAddress:mint,amountUsdcMicros:1000000n
  }});
  let requests=[];
  globalThis.fetch=async(input,init)=>{
   const url=String(input);
   requests.push({url,method:init?.method??"GET"});
   if(url.endsWith("/resend-webhook"))return Response.json({ok:true});
   return Response.json({data:[recorded,unknown,unrelated]});
  };
  response=await call();
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{
   scanned:2,missing:1,replayRequested:1,complete:true,
   note:"Scanned all returned pages"
  });
  assert.equal(requests.filter(x=>x.method==="POST").length,1);
  assert.ok(requests.some(x=>x.url.endsWith("/ci-missing-deposit/resend-webhook")));
  assert.equal(await db.blockchainDeposit.count({where:{providerTransactionId:"ci-missing-deposit"}}),0,
   "Reconciliation must request authenticated webhook replay, not credit balances");
  globalThis.fetch=async(input)=>{
   if(String(input).endsWith("/resend-webhook"))return new Response("unavailable",{status:503});
   return Response.json({data:[unknown]});
  };
  response=await call();
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{
   error:"Reconciliation failed; retry required",scanned:1,missing:1,replayRequested:0,complete:false
  });
  // A later-page transport failure must not claim complete reconciliation.
  // Previously requested webhook replay does not imply that the ledger is credited.
  const pageOne=[unknown,...Array.from({length:99},(_,i)=>({
   id:"ci-skipped-"+i,status:"PENDING",type:"DEPOSIT"
  }))];
  let replayCalls=0;
  globalThis.fetch=async(input,init)=>{
   const url=String(input);
   if(init?.method==="POST"){replayCalls++;return Response.json({ok:true});}
   const page=new URL(url).searchParams.get("page");
   return page==="1"?Response.json({data:pageOne}):new Response("upstream outage",{status:503});
  };
  response=await call();
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{
   error:"Reconciliation failed; retry required",scanned:1,missing:1,replayRequested:1,complete:false
  });
  assert.equal(replayCalls,1);
  assert.equal(await db.blockchainDeposit.count({where:{providerTransactionId:"ci-missing-deposit"}}),0);
  globalThis.fetch=async(input,init)=>{
   if(init?.method==="POST"){replayCalls++;return Response.json({ok:true});}
   return Response.json({data:new URL(String(input)).searchParams.get("page")==="1"?pageOne:[]});
  };
  response=await call();
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{
   scanned:1,missing:1,replayRequested:1,complete:true,note:"Scanned all returned pages"
  });
  assert.equal(replayCalls,2,"safe retry requests replay again until authenticated processing records the deposit");
  assert.equal(await db.blockchainDeposit.count({where:{providerTransactionId:"ci-missing-deposit"}}),0);
 }finally{
  await db.blockchainDeposit.deleteMany({where:{providerTransactionId:txId}});
  await db.investorDepositWallet.deleteMany({where:{userId}});
  await db.user.deleteMany({where:{id:userId}});
  await db.$disconnect();
 }
 console.log("Blockradar reconciliation route source coverage passed");
}finally{
 globalThis.fetch=originalFetch;
 for(const name of names){if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name];}
}
