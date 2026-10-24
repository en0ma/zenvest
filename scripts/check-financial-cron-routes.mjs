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
const previous=process.env.CRON_SECRET;
try{
 process.env.CRON_SECRET="ci-cron-route-secret";
 const paths=[
  "../src/app/api/internal/process-webhook-queue/route.ts",
  "../src/app/api/internal/process-withdrawals/route.ts",
  "../src/app/api/internal/process-position-allocations/route.ts",
  "../src/app/api/internal/process-position-trade-pnl/route.ts",
  "../src/app/api/internal/blockradar-deposit-finder/route.ts",
  "../src/app/api/internal/blockradar-sweep-assets/route.ts",
  "../src/app/api/internal/reconcile-blockradar/route.ts",
 ];
 for(const path of paths){
  const {GET}=await import(path);
  const missing=await GET(new Request("https://ci.invalid/internal"));
  assert.equal(missing.status,401,path+" must reject absent cron authorization");
  const invalid=await GET(new Request("https://ci.invalid/internal",{headers:{authorization:"Bearer wrong"}}));
  assert.equal(invalid.status,401,path+" must reject incorrect cron authorization");
 }
 // Authenticated worker endpoint must execute the real worker against CI
 // PostgreSQL and report its outcome without exposing cacheable responses.
 const priorKey=process.env.BLOCK_RADAR_API_KEY;
 const priorWallet=process.env.BLOCK_RADAR_MASTER_WALLET_ID;
 const priorAsset=process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID;
 const {PrismaClient}=await import("@prisma/client");
 const db=new PrismaClient();
 try{
  const master=await db.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
  process.env.BLOCK_RADAR_API_KEY="ci-worker-route";
  process.env.BLOCK_RADAR_MASTER_WALLET_ID=master.walletId;
  process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID="ci-usdc";
  const {GET:processWithdrawals}=await import("../src/app/api/internal/process-withdrawals/route.ts");
  const authorized=new Request("https://ci.invalid/internal/process-withdrawals",{
   headers:{authorization:"Bearer ci-cron-route-secret"}});
  const response=await processWithdrawals(authorized);
  assert.equal(response.status,200);
  assert.equal((await response.json()).outcome,"empty");
  assert.equal(response.headers.get("cache-control"),"no-store");
  // An empty, authenticated webhook queue may be polled safely without
  // touching provider networks or posting any financial transfers.
  const {GET:processWebhooks}=await import("../src/app/api/internal/process-webhook-queue/route.ts");
  const webhookResponse=await processWebhooks(authorized);
  assert.equal(webhookResponse.status,200);
  assert.equal(webhookResponse.headers.get("cache-control"),"no-store");
  assert.ok((await webhookResponse.json()).outcome!==undefined);
  // Exercise the authenticated P&L cron route with no unsettled trades.
  // The real service must return an outcome and a non-cacheable response.
  const {GET:processTradePnl}=await import("../src/app/api/internal/process-position-trade-pnl/route.ts");
  const pnlResponse=await processTradePnl(authorized);
  assert.equal(pnlResponse.status,200);
  assert.equal(pnlResponse.headers.get("cache-control"),"no-store");
  assert.ok(Object.hasOwn(await pnlResponse.json(),"results"));


 }finally{
  await db.$disconnect();
  for(const [key,val] of [
   ["BLOCK_RADAR_API_KEY",priorKey],
   ["BLOCK_RADAR_MASTER_WALLET_ID",priorWallet],
   ["BLOCKRADAR_SOLANA_USDC_ASSET_ID",priorAsset]
  ]){if(val===undefined)delete process.env[key];else process.env[key]=val;}
 }
 console.log("Financial worker cron route authentication passed");
}finally{
 if(previous===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=previous;
}
