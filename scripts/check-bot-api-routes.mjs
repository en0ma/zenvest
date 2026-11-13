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
 assert.equal((await strategies.POST(req("/api/v1/strategies",{...body,min_allocation:"800",max_allocation:"100"},raw))).status,400);
 assert.equal((await strategies.POST(req("/api/v1/strategies",{...body,side:"yes"},raw))).status,400);
 const configured=await strategies.POST(req("/api/v1/strategies",{...body,strategy_id:strategyId},raw));
 assert.equal(configured.status,201);
 assert.equal((await db.strategy.findUniqueOrThrow({where:{id:strategyId}})).minAllocationUsdcMicros,5000000n);
 assert.equal((await strategies.POST(req("/api/v1/strategies",{...body,strategy_id:strategyId},raw))).status,409);
 const created=await strategies.POST(req("/api/v1/strategies",body,raw));
 assert.equal(created.status,201);
 const secondId=(await created.json()).strategy_id;
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
 assert.equal((await managerKey.DELETE(req("/api/bot-manager/keys/"+keyId,{},null,"DELETE"),keyCtx(keyId))).status,200);
 assert.equal((await strategies.GET(req("/api/v1/strategies",null,raw,"GET"))).status,401,"revoked key cannot access any strategy");
 assert.equal((await db.botTradeIntent.count({where:{strategyId}})),2,"unexecuted intents never become verified trades");
 console.log("Bot manager/v1 PostgreSQL route integration passed: API key lifecycle, ownership isolation, onboarding state, allocation bounds, canonical trade sides, idempotency and rate limiting");
}finally{
 await db.botApiRateLimit.deleteMany({where:{key:{ownerId:managerId}}});
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
