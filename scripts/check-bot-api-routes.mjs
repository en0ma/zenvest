import assert from "node:assert/strict";
import {registerHooks} from "node:module";
import {PrismaClient} from "@prisma/client";
const here=new URL(".",import.meta.url);
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="@/lib/bot-manager-access")return nextResolve(new URL("ci-bot-manager-access-shim.mjs",here).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",here).href,context);
 if(specifier.startsWith("./")&&context.parentURL?.includes("/src/lib/")&&!/\.[cm]?[jt]s$/.test(specifier))
  return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("Refusing non-CI database");
const db=new PrismaClient();
const managerId="ci_bot_api_manager",strangerId="ci_bot_api_stranger";
let testPublicKey="";
let testKeyId="";
const req=(path,body,token,method="POST",headers={})=>new Request("http://ci.local"+path,{
 method,headers:{"content-type":"application/json",...(token?{"x-zenvest-api-key":testKeyId,"x-zenvest-api-secret":token}:{}),...(testPublicKey?{"x-zenvest-strategy-pubkey":testPublicKey}:{}),...headers},
 ...(method==="GET"?{}:{body:typeof body==="string"?body:JSON.stringify(body)})
});
const managerBots=await import("../src/app/api/bot-manager/bots/route.ts");
const managerKeys=await import("../src/app/api/bot-manager/keys/route.ts");
const managerKey=await import("../src/app/api/bot-manager/keys/[keyId]/route.ts");
const strategies=await import("../src/app/api/v1/strategies/route.ts");
const trade=await import("../src/app/api/v1/strategies/[strategyId]/trade/route.ts");
const allocations=await import("../src/app/api/v1/strategies/[strategyId]/allocations/route.ts");
const sandbox=await import("../src/app/api/v1/strategies/[strategyId]/sandbox/trade/route.ts");
const sandboxSettle=await import("../src/app/api/v1/strategies/[strategyId]/sandbox/settle/route.ts");
const sandboxSummary=await import("../src/app/api/v1/strategies/[strategyId]/sandbox/summary/route.ts");
const overview=await import("../src/app/api/bot-manager/overview/route.ts");
const monthlyAccounting=await import("../src/app/api/bot-manager/accounting/monthly/route.ts");
const pruneLimits=await import("../src/app/api/internal/prune-bot-api-rate-limits/route.ts");
const nativeFetch=globalThis.fetch;
let marketResolved=false;
globalThis.fetch=async(url)=>{
 const path=new URL(String(url));
 assert.equal(path.origin,"https://external-api.kalshi.com","Sandbox must use real Kalshi read-only origin");
 assert.ok(path.pathname.includes("/markets/BTC-15min-123"));
 if(path.pathname.endsWith("/orderbook"))
  return Response.json({orderbook_fp:{yes_dollars:[["0.40","20"],["0.35","20"]],
   no_dollars:[["0.55","20"],["0.54","20"]]}});
 return Response.json({market:{ticker:"BTC-15min-123",series_ticker:"BTC-15min",
  status:marketResolved?"settled":"open",result:marketResolved?"yes":null}});
};
const keyCtx=id=>({params:Promise.resolve({keyId:id})});
const strategyCtx=id=>({params:Promise.resolve({strategyId:id})});
const body={market_type:"event",venue:"kalshi",asset:"BTC-15min",min_allocation:"5",max_allocation:"500"};
let raw="",keyId="",strategyId="",strangerStrategyId="";
try{
 const role=await db.role.findUniqueOrThrow({where:{key:"bot"}});
 for(const [id,email] of [[managerId,"ci-bot-manager@example.invalid"],[strangerId,"ci-bot-stranger@example.invalid"]]){
  await db.user.create({data:{id,name:id,email,passwordHash:"ci-fixture-only",emailVerifiedAt:new Date()}});
  await db.twoFactor.create({data:{userId:id,method:"totp",verifiedAt:new Date()}});
  await db.userRole.create({data:{userId:id,roleId:role.id,assignedBy:"ci-only"}});
 }
 assert.equal((await managerKeys.POST(req("/api/bot-manager/keys","bad-json"))).status,400);
 assert.equal((await managerKeys.POST(req("/api/bot-manager/keys",{label:""}))).status,400);
 const keyResponse=await managerKeys.POST(req("/api/bot-manager/keys",{label:"Shared key"}));
 assert.equal(keyResponse.status,201);
 const secret=await keyResponse.json();raw=secret.apiSecret;keyId=secret.apiKey;testKeyId=keyId;
 assert.match(raw,/^zvb_[A-Za-z0-9_-]{43}$/);
 assert.equal((await managerKeys.GET()).status,200);
 assert.equal((await strategies.GET(req("/api/v1/strategies",null,null,"GET"))).status,401);
 assert.equal((await strategies.GET(req("/api/v1/strategies",null,raw,"GET"))).status,200);
 assert.equal((await managerBots.POST(req("/api/bot-manager/bots",{name:"a"}))).status,400);
 const botResult=await managerBots.POST(req("/api/bot-manager/bots",{name:"Fixture Bot",description:"Manager owned",...body}));
 assert.equal(botResult.status,201);
 strategyId=(await botResult.json()).bot.strategyId;
 testPublicKey=(await db.strategy.findUniqueOrThrow({where:{id:strategyId}})).publicKey;
 assert.equal((await managerBots.GET()).status,200);
 assert.equal((await allocations.GET(req("/api/v1/strategies/"+strategyId+"/allocations",null,raw,"GET",
  {"x-zenvest-strategy-pubkey":""}),strategyCtx(strategyId))).status,400,"strategy pubkey is mandatory");
 assert.equal((await allocations.GET(req("/api/v1/strategies/"+strategyId+"/allocations",null,raw,"GET",
  {"x-zenvest-strategy-pubkey":"zvs_wrong"}),strategyCtx(strategyId))).status,403,"pubkey must match owned strategy");
 assert.equal((await strategies.GET(req("/api/v1/strategies",null,"zvb_"+"A".repeat(43),"GET"))).status,401,"unknown secret rejected");
 assert.equal((await strategies.GET(req("/api/v1/strategies",null,raw,"GET",
  {"x-zenvest-api-key":"unknown-credential"}))).status,401,"unknown key ID rejected");
 assert.equal((await strategies.POST(req("/api/v1/strategies",{...body,min_allocation:"800",max_allocation:"100"},raw))).status,400);
 assert.equal((await strategies.POST(req("/api/v1/strategies",{...body,side:"yes"},raw))).status,400);
 const configured=await strategies.POST(req("/api/v1/strategies",{...body,strategy_id:strategyId},raw));
 assert.equal(configured.status,409,"dashboard-created strategy is already configured");
 assert.equal((await db.strategy.findUniqueOrThrow({where:{id:strategyId}})).minAllocationUsdcMicros,5000000n);
 assert.equal((await strategies.POST(req("/api/v1/strategies",{...body,strategy_id:strategyId},raw))).status,409);
 const created=await strategies.POST(req("/api/v1/strategies",body,raw));
 assert.equal(created.status,201);
 const secondCreated=await created.json();
 const secondId=secondCreated.strategy_id;
 const emptySandbox=await sandboxSummary.GET(req("/api/v1/strategies/"+secondId+"/sandbox/summary",
  null,raw,"GET",{"x-zenvest-strategy-pubkey":secondCreated.strategy_pubkey}),strategyCtx(secondId));
 assert.equal(emptySandbox.status,200,"new strategy should show an empty, isolated sandbox");
 const emptySummary=await emptySandbox.json();
 assert.equal(emptySummary.virtual_cash_usdc_micros,"10000000000");
 assert.equal(emptySummary.realized_virtual_pnl_usdc_micros,"0");
 assert.equal(emptySummary.recent_fills.length,0);
 assert.equal(emptySummary.open_virtual_positions.length,0);
 const noFee=await sandbox.POST(req("/api/v1/strategies/"+secondId+"/sandbox/trade",{
  order_type:"buy",trade_size:1,event_id:"BTC-15min-123",side:"yes"
 },raw,"POST",{"x-zenvest-strategy-pubkey":secondCreated.strategy_pubkey,
  "idempotency-key":"no-fee-config-0001"}),strategyCtx(secondId));
 assert.equal(noFee.status,409,"sandbox without admin fee policy must reject simulations");
 const monthlyUrl=(sid,month="2026-01")=>"http://ci.local/api/bot-manager/accounting/monthly?strategy_id="+encodeURIComponent(sid)+"&month="+month;
 assert.equal((await monthlyAccounting.GET(req(monthlyUrl(strangerStrategyId||"not-owned"),null,null,"GET"))).status,403,
  "monthly statements are restricted to owner");
 assert.equal((await monthlyAccounting.GET(req(monthlyUrl(secondId,"2026-13"),null,null,"GET"))).status,400);
 const periodOpen=await monthlyAccounting.GET(req(monthlyUrl(secondId,"2099-01"),null,null,"GET"));
 assert.equal((await periodOpen.json()).status,"OPEN_PERIOD");
 const emptyMonth=await monthlyAccounting.GET(req(monthlyUrl(secondId),null,null,"GET"));
 assert.equal((await emptyMonth.json()).status,"NO_VERIFIED_TRADES");
 const monthlyTradeId="ci_bot_monthly_verified_trade";
 await db.strategyTrade.create({data:{
  id:monthlyTradeId,strategyId:secondId,marketTradeName:"CI monthly bookkeeping",marketTradeId:"ci-accounting-verified",
  status:"SETTLED",settledAt:new Date("2026-01-10T12:00:00Z"),
  realizedPnlUsdcMicros:10_000_000n,appliedManagerProfitPercentage:"30.0000",
  appliedPlatformStrategyPercentage:"20.0000"
 }});
 const pendingFees=await monthlyAccounting.GET(req(monthlyUrl(secondId),null,null,"GET"));
 assert.equal((await pendingFees.json()).status,"PENDING_VERIFIED_COST_EVIDENCE",
  "verified trade cannot claim net profit without cost evidence");
 await db.botTradeVerifiedCosts.create({data:{
  strategyTradeId:monthlyTradeId,venueFeeMicros:1_000_000n,custodyFeeMicros:500_000n,
  operationalFeeMicros:500_000n,venueEvidenceRef:"ci-venue-proof",
  custodyEvidenceRef:"ci-custody-proof",operationsEvidenceRef:"ci-ops-proof",
  verifiedAt:new Date(),grossPreCostVerified:true
 }});
 const calculated=await monthlyAccounting.GET(req(monthlyUrl(secondId),null,null,"GET"));
 assert.equal(calculated.status,200);
 const statement=await calculated.json();
 assert.equal(statement.status,"CALCULATED_AWAITING_CUSTODY_RECONCILIATION");
 assert.equal(statement.payable,false);
 assert.equal(statement.manager_earnings_usdc_micros,"0");
 assert.equal(statement.net_profit_usdc_micros,"8000000");
 assert.equal(statement.hypothetical_manager_share_usdc_micros,"2400000");
 assert.equal(statement.hypothetical_platform_share_usdc_micros,"1600000");
 assert.equal(statement.hypothetical_investor_share_usdc_micros,"4000000");
 assert.equal(await db.botStrategyRevenueAccounting.count({where:{strategyId:secondId}}),0,
  "monthly preview must not create legacy fee records or payment liabilities");
 assert.notEqual(secondId,strategyId);
 const listed=await strategies.GET(req("/api/v1/strategies",null,raw,"GET"));
 assert.equal(listed.status,200);
 assert.equal((await listed.json()).strategies.length,2);
 const strangerStrategy=await db.strategy.create({data:{
  id:"ci_bot_api_other_strategy",name:"CI Other Manager Bot Strategy",description:"Foreign strategy",status:"MONITORING",
  venue:"kalshi",eventTag:"BTC-15min"
 }});
 strangerStrategyId=strangerStrategy.id;
 await db.bot.create({data:{ownerId:strangerId,strategyId:strangerStrategyId,name:"Other Manager's Bot"}});
 assert.equal((await allocations.GET(req("/api/v1/strategies/"+strangerStrategyId+"/allocations",null,raw,"GET"),strategyCtx(strangerStrategyId))).status,403);
 const tradeRequest=(id,side,key="same-trade-id-0001")=>req("/api/v1/strategies/"+id+"/trade",{
  order_type:"buy",trade_size:5,event_id:"BTC-15min-123",side
 },raw,"POST",{"idempotency-key":key});
 assert.equal((await trade.POST(tradeRequest(strategyId,"up"),strategyCtx(strategyId))).status,409,"ONBOARDING blocks trade intents");
 await db.strategy.update({where:{id:strategyId},data:{status:"MONITORING",isPublic:true}});
 const readAlloc=await allocations.GET(req("/api/v1/strategies/"+strategyId+"/allocations",null,raw,"GET"),strategyCtx(strategyId));
 assert.equal(readAlloc.status,200);
 assert.equal((await readAlloc.json()).accepts_new_allocations,false);
 assert.equal((await trade.POST(tradeRequest(strategyId,"up"),strategyCtx(strategyId))).status,409,"MONITORING blocks bot trade intents");
 assert.equal((await db.botTradeIntent.count({where:{strategyId}})),0,"MONITORING must not persist trade intents");
 await db.strategy.update({where:{id:strategyId},data:{status:"TRADING",isActive:true,isPublic:true}});
 const sandboxRequest=(side,key,orderType="buy",qty=5)=>req("/api/v1/strategies/"+strategyId+"/sandbox/trade",{
  order_type:orderType,trade_size:qty,event_id:"BTC-15min-123",side
 },raw,"POST",{"idempotency-key":key});
 await db.strategy.update({where:{id:strategyId},data:{status:"ONBOARDING",isPublic:false,sandboxFeeBps:100}});
 assert.equal((await sandbox.POST(sandboxRequest("yes","invalid-lot-0001","buy",0),strategyCtx(strategyId))).status,400,
  "invalid quantity must fail before venue fetch");
 assert.equal((await sandbox.POST(req("/api/v1/strategies/"+strategyId+"/sandbox/trade",{
  order_type:"buy",trade_size:1,event_id:"BTC-15min-123",side:"yes"
 },raw,"POST"),strategyCtx(strategyId))).status,400,"sandbox requires idempotency");
 assert.equal((await sandbox.POST(sandboxRequest("no","virtual-noinventory-001","sell",1),strategyCtx(strategyId))).status,409,
  "virtual sell cannot invent inventory");
 assert.equal((await sandbox.POST(sandboxRequest("yes","virtual-illiquid-0001","buy",50),strategyCtx(strategyId))).status,503,
  "virtual execution rejects insufficient venue book depth");
 assert.equal((await sandboxSettle.POST(req("/api/v1/strategies/"+strategyId+"/sandbox/settle",
  {event_id:"BTC-15min-123"},raw),strategyCtx(strategyId))).status,409,
  "open venue events cannot settle sandbox positions");
 assert.equal((await sandboxSettle.POST(req("/api/v1/strategies/"+strategyId+"/sandbox/settle",
  null,raw),strategyCtx(strategyId))).status,400,"null settlement body rejected");
 assert.equal((await sandboxSettle.POST(req("/api/v1/strategies/"+strategyId+"/sandbox/settle",
  {event_id:"INVALID/ID"},raw),strategyCtx(strategyId))).status,400,"malformed venue event rejected");
 assert.equal((await sandboxSettle.POST(req("/api/v1/strategies/"+strategyId+"/sandbox/settle",
  {event_id:"BTC-15min-123",result:"yes"},raw),strategyCtx(strategyId))).status,400,
  "user-supplied settlement result forbidden");
 const virtual=await sandbox.POST(sandboxRequest("yes","virtual-trade-0001"),strategyCtx(strategyId));
 assert.equal(virtual.status,201,"real Kalshi read-only book fixture can simulate sandbox fills");
 assert.equal((await virtual.json()).is_real_trade,false);
 assert.equal((await sandbox.POST(sandboxRequest("up","virtual-trade-0001"),strategyCtx(strategyId))).status,200,"virtual replay is idempotent");
 assert.equal((await sandbox.POST(sandboxRequest("no","virtual-trade-0001"),strategyCtx(strategyId))).status,409,"conflicting sandbox replay rejected");
 assert.equal((await sandbox.POST(sandboxRequest("yes","virtual-sell-00002","sell",2),strategyCtx(strategyId))).status,201,"selling simulated inventory must use bid-side liquidity");
 const summary=await sandboxSummary.GET(req("/api/v1/strategies/"+strategyId+"/sandbox/summary",null,raw,"GET"),strategyCtx(strategyId));
 assert.equal(summary.status,200);
 assert.equal((await summary.json()).environment,"SANDBOX_ONLY");
 marketResolved=true;
 const settlement=await sandboxSettle.POST(req("/api/v1/strategies/"+strategyId+"/sandbox/settle",
  {event_id:"BTC-15min-123"},raw),strategyCtx(strategyId));
 assert.equal(settlement.status,201,"verified venue outcome settles virtual cash only");
 assert.equal((await sandboxSettle.POST(req("/api/v1/strategies/"+strategyId+"/sandbox/settle",
  {event_id:"BTC-15min-123"},raw),strategyCtx(strategyId))).status,200,"virtual settlement idempotent");
 assert.equal((await db.sandboxSettlement.count({where:{strategyId}})),1);
 marketResolved=false;
 await db.strategy.update({where:{id:strategyId},data:{status:"TRADING",isActive:true,isPublic:true}});
 assert.equal((await sandbox.POST(sandboxRequest("yes","virtual-denied-0003"),strategyCtx(strategyId))).status,409,"live TRADING cannot write virtual sandbox fills");
 assert.equal((await overview.GET()).status,200,"manager dashboard exposes separated sandbox and live records");
 const firstTrade=await trade.POST(tradeRequest(strategyId,"up"),strategyCtx(strategyId));
 assert.equal(firstTrade.status,202);
 const firstBody=await firstTrade.json();assert.equal(firstBody.executed,false);
 assert.equal(firstBody.canonical_side,"yes");
 assert.equal((await trade.POST(tradeRequest(strategyId,"yes"),strategyCtx(strategyId))).status,202,"synonymous sides deduplicate");
 assert.equal((await db.botTradeIntent.count({where:{strategyId}})),1);
 assert.equal((await trade.POST(tradeRequest(strategyId,"down"),strategyCtx(strategyId))).status,409,"conflicting idempotent payload denied");
 const secondTrade=await trade.POST(tradeRequest(strategyId,"no","second-trade-0002"),strategyCtx(strategyId));
 assert.equal(secondTrade.status,202);
 assert.equal((await secondTrade.json()).canonical_side,"no");
 assert.equal((await trade.POST(tradeRequest(strangerStrategyId,"yes","foreign-trade-0001"),strategyCtx(strangerStrategyId))).status,403);
 await db.strategy.update({where:{id:strategyId},data:{status:"TRADING",isActive:true,isPublic:true}});
 const tradingAlloc=await allocations.GET(req("/api/v1/strategies/"+strategyId+"/allocations",null,raw,"GET"),strategyCtx(strategyId));
 assert.equal((await tradingAlloc.json()).accepts_new_allocations,true);
 await db.strategy.update({where:{id:strategyId},data:{status:"SHUTTING_DOWN",isActive:false,isPublic:false}});
 assert.equal((await trade.POST(tradeRequest(strategyId,"no","shutdown-trade-0001"),strategyCtx(strategyId))).status,409);
 let throttled=false;
 for(let n=0;n<65;n++){
  const response=await strategies.GET(req("/api/v1/strategies",null,raw,"GET"));
  if(response.status===429){assert.ok(Number(response.headers.get("Retry-After"))>0);throttled=true;break}
  assert.equal(response.status,200);
 }
 assert.equal(throttled,true,"shared manager key must be rate limited");
 // Rate limit retention must preserve today's live window and recent audit data,
 // including rejected requests, while pruning old windows in bounded batches.
 const oldWindow=new Date(Date.now()-31*24*60*60*1000);
 const recentWindow=new Date(Date.now()-29*24*60*60*1000);
 await db.botApiRateLimit.create({data:{keyId,windowStart:oldWindow,requestCount:7,rejectedCount:2}});
 await db.botApiRateLimit.create({data:{keyId,windowStart:recentWindow,requestCount:4,rejectedCount:1}});
 const liveWindow=new Date(Math.floor(Date.now()/60000)*60000);
 const activeBefore=await db.botApiRateLimit.findUniqueOrThrow({where:{keyId_windowStart:{keyId,windowStart:liveWindow}}});
 const previousCronSecret=process.env.CRON_SECRET;
 process.env.CRON_SECRET="ci-prune-bot-limiter-secret";
 try{
  const path="/api/internal/prune-bot-api-rate-limits";
  const noAuth=await pruneLimits.GET(req(path,null,null,"GET"));
  assert.equal(noAuth.status,401,"unauthenticated cleanup must be forbidden");
  const invalid=await pruneLimits.GET(req(path,null,null,"GET",{authorization:"Bearer wrong"}));
  assert.equal(invalid.status,401,"incorrect cleanup cron secret must be forbidden");
  assert.ok(await db.botApiRateLimit.findUnique({where:{keyId_windowStart:{keyId,windowStart:oldWindow}}}),
    "unauthorized cleanup cannot delete a window");
  const valid=await pruneLimits.GET(req(path,null,null,"GET",{
   authorization:"Bearer ci-prune-bot-limiter-secret"
  }));
  assert.equal(valid.status,200,"authorized cleanup succeeds");
  assert.equal((await valid.json()).deleted,1,"only expired windows are removed");
  assert.equal(await db.botApiRateLimit.findUnique({where:{keyId_windowStart:{keyId,windowStart:oldWindow}}}),null);
  assert.ok(await db.botApiRateLimit.findUnique({where:{keyId_windowStart:{keyId,windowStart:recentWindow}}}),
    "recent rate-limit history is retained");
  const activeAfter=await db.botApiRateLimit.findUniqueOrThrow({where:{keyId_windowStart:{keyId,windowStart:liveWindow}}});
  assert.equal(activeAfter.requestCount,activeBefore.requestCount,"active limiter accounting remains unchanged");
  assert.equal(activeAfter.rejectedCount,activeBefore.rejectedCount,"live rejection counters remain unchanged");
  const repeat=await pruneLimits.GET(req(path,null,null,"GET",{
   authorization:"Bearer ci-prune-bot-limiter-secret"
  }));
  assert.equal((await repeat.json()).deleted,0,"cleanup is idempotent");
 }finally{
  if(previousCronSecret===undefined)delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET=previousCronSecret;
 }

 assert.equal((await managerKey.DELETE(req("/api/bot-manager/keys/"+keyId,{},null,"DELETE"),keyCtx(keyId))).status,200);
 assert.equal((await strategies.GET(req("/api/v1/strategies",null,raw,"GET"))).status,401,"revoked key cannot access any strategy");
 assert.equal((await db.botTradeIntent.count({where:{strategyId}})),2,"unexecuted intents never become verified trades");
 console.log("Bot manager/v1 PostgreSQL route integration passed: API key lifecycle, ownership isolation, onboarding state, allocation bounds, canonical trade sides, idempotency and rate limiting");
}finally{
 globalThis.fetch=nativeFetch;
 await db.sandboxSettlement.deleteMany({where:{strategyId:{in:[strategyId,strangerStrategyId]}}});
 await db.sandboxFill.deleteMany({where:{strategyId:{in:[strategyId,strangerStrategyId]}}});
 await db.sandboxPosition.deleteMany({where:{strategyId:{in:[strategyId,strangerStrategyId]}}});
 await db.sandboxAccount.deleteMany({where:{strategyId:{in:[strategyId,strangerStrategyId]}}});
 await db.botApiRateLimit.deleteMany({where:{key:{ownerId:managerId}}});
 await db.botTradeVerifiedCosts.deleteMany({where:{strategyTradeId:"ci_bot_monthly_verified_trade"}});
 await db.strategyTrade.deleteMany({where:{id:"ci_bot_monthly_verified_trade"}});
 await db.botTradeIntent.deleteMany({where:{bot:{ownerId:{in:[managerId,strangerId]}}}});
 await db.botApiKey.deleteMany({where:{ownerId:managerId}});
 await db.bot.deleteMany({where:{ownerId:{in:[managerId,strangerId]}}});
 await db.strategy.deleteMany({where:{id:{in:[strategyId,strangerStrategyId]}}});
 await db.strategy.deleteMany({where:{name:{startsWith:"BTC-15min · "}}});
 await db.userRole.deleteMany({where:{userId:{in:[managerId,strangerId]},role:{key:"bot"}}});
 await db.twoFactor.deleteMany({where:{userId:{in:[managerId,strangerId]}}});
 await db.user.deleteMany({where:{id:{in:[managerId,strangerId]}}});
 await db.$disconnect();
}
