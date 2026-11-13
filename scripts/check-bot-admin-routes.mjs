import assert from "node:assert/strict";
import {registerHooks} from "node:module";
import {PrismaClient} from "@prisma/client";
const here=new URL(".",import.meta.url);
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="@/lib/staff-access")return nextResolve(new URL("ci-bot-admin-access-shim.mjs",here).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",here).href,context);
 if(specifier.startsWith("./")&&context.parentURL?.includes("/src/lib/")&&!/\.[cm]?[jt]s$/.test(specifier))
  return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("Refusing non-CI database");
const db=new PrismaClient();
const {PUT:settings}=await import("../src/app/api/admin/bot-strategies/[id]/settings/route.ts");
const {POST:lifecycle}=await import("../src/app/api/admin/bot-strategies/[id]/lifecycle/route.ts");
const {deliverBotManagerNotices}=await import("../src/lib/bot-manager-notices.ts");
const actor="ci_bot_admin",owner="ci_bot_target",strategyId="ci_bot_admin_strategy";
let superRoleId="",botRoleId="";
const ctx={params:Promise.resolve({id:strategyId})};
const req=(body,method="POST")=>new Request("https://ci.invalid/api/admin/bot-strategies/"+strategyId,{
 method,headers:{"content-type":"application/json"},body:JSON.stringify(body)});
const valid={manager_percentage:"30",platform_percentage:"20",
 sandbox_fee_bps:100,admission_min_days:7,admission_min_fills:30,
 admission_max_drawdown_pct:"10",total_capacity_usdc:"500"};
try{
 const superRole=await db.role.upsert({where:{key:"super-admin"},create:{key:"super-admin"},update:{}});
 const botRole=await db.role.findUniqueOrThrow({where:{key:"bot"}});
 superRoleId=superRole.id;botRoleId=botRole.id;
 for(const [id,roleId] of [[actor,superRole.id],[owner,botRole.id]]){
  await db.user.create({data:{id,email:id+"@example.invalid",name:"CI Bot Admin Fixture",passwordHash:"ci-only",
   emailVerifiedAt:new Date()}});
  await db.userRole.create({data:{userId:id,roleId,assignedBy:"ci-only"}});
 }
 await db.strategy.create({data:{id:strategyId,name:"CI Bot Admin Strategy",description:"CI disposable",
  status:"ONBOARDING",publicKey:"zvs_ci_admin_fixture",
  venue:"kalshi",eventTag:"BTC-15min",
  minAllocationUsdcMicros:5000000n,maxAllocationUsdcMicros:50000000n}});
 await db.bot.create({data:{ownerId:owner,strategyId,name:"CI Bot Admin"}});
 assert.equal((await lifecycle(req({status:"MONITORING"}),ctx)).status,409,"missing admin sandbox fee policy blocks promotion");
 assert.equal((await settings(req({...valid,manager_percentage:"90",platform_percentage:"50"},"PUT"),ctx)).status,400,"shares cannot exceed 100%");
 assert.equal((await settings(req({...valid,total_capacity_usdc:"2"},"PUT"),ctx)).status,409,"capacity below allocation ceiling denied");
 assert.equal((await settings(req(valid,"PUT"),ctx)).status,200,"admin policy and revenue percentages saved");
 assert.equal(await db.strategyRevenueRateVersion.count({where:{strategyId}}),1);
 assert.equal((await lifecycle(req({status:"MONITORING"}),ctx)).status,409,"unproven sandbox admission blocked");
 assert.equal((await lifecycle(req({status:"MONITORING",override_admission:true,override_reason:"too short"}),ctx)).status,400);
 const reason="Reviewed CI-only sandbox strategy for manual admission exception";
 assert.equal((await lifecycle(req({status:"MONITORING",override_admission:true,override_reason:reason}),ctx)).status,200);
 assert.equal(await db.botAdmissionOverride.count({where:{strategyId}}),1);
 const observed=await db.strategy.findUniqueOrThrow({where:{id:strategyId}});
 assert.equal(observed.status,"MONITORING");
 assert.equal(observed.isPublic,true);assert.equal(observed.isActive,false);
 assert.equal((await lifecycle(req({status:"TRADING",override_admission:true,override_reason:reason}),ctx)).status,409,"wallets required");
 assert.equal(await db.botAdmissionOverride.count({where:{strategyId}}),1,"rejected transition must not log an approved override");
 await db.strategy.update({where:{id:strategyId},data:{
  kalshiWalletAddress:"11111111111111111111111111111111",
  blockRadarAddress:"CI_BOT_PROVIDER_ADDR",blockRadarAddressId:"ci-bot-provider-wallet"
 }});
 const missing=await lifecycle(req({status:"TRADING",override_admission:true,override_reason:reason}),ctx);
 assert.equal(missing.status,409);
 assert.match((await missing.json()).error,/verification/i,"provider identities alone do not establish verification");
 assert.equal(await db.botAdmissionOverride.count({where:{strategyId}}),1);
 // CI may set the provider-verified timestamps only by direct DB fixture, not via
 // an API that a manager or admin could use to forge custody verification.
 await db.strategy.update({where:{id:strategyId},data:{venueVerifiedAt:new Date(),custodyVerifiedAt:new Date()}});
 assert.equal((await lifecycle(req({status:"TRADING",override_admission:true,override_reason:reason}),ctx)).status,200);
 const trading=await db.strategy.findUniqueOrThrow({where:{id:strategyId}});
 assert.equal(trading.status,"TRADING");
 assert.equal(trading.isActive,true);
 assert.equal(await db.botAdmissionOverride.count({where:{strategyId}}),2);
 const changed={...valid,manager_percentage:"25",platform_percentage:"20"};
 assert.equal((await settings(req(changed,"PUT"),ctx)).status,200);
 assert.equal(await db.strategyRevenueRateVersion.count({where:{strategyId}}),2,"future fee changes are versioned, never retroactive");
 assert.equal((await lifecycle(req({status:"SHUTTING_DOWN"}),ctx)).status,200);
 const closing=await db.strategy.findUniqueOrThrow({where:{id:strategyId}});
 assert.equal(closing.status,"SHUTTING_DOWN");assert.equal(closing.isActive,false);
 assert.equal((await settings(req(valid,"PUT"),ctx)).status,409,"shutdown settings are locked");
 // Delivery outage must not manufacture a success or remove the durable notice.
 await db.botManagerNotice.create({data:{userId:owner,kind:"APPROVED"}});
 const previousEmailKey=process.env.RESEND_API_KEY;
 process.env.RESEND_API_KEY="";
 try{
  const notifications=await deliverBotManagerNotices(1);
  assert.equal(notifications.length,1);
  assert.equal(notifications[0].outcome,"RETRY_PENDING");
  const queued=await db.botManagerNotice.findFirstOrThrow({where:{userId:owner}});
  assert.equal(queued.status,"PENDING");
  assert.equal(queued.attempts,1);
 }finally{
  if(previousEmailKey===undefined)delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY=previousEmailKey;
 }
 console.log("Bot admin integration passed: capacity, sandbox policy, overrides with reason, immutable fee versions and fail-closed provider verification");
}finally{
 await db.botManagerNotice.deleteMany({where:{userId:{in:[actor,owner]}}});
 await db.staffAudit.deleteMany({where:{targetId:strategyId}});
 await db.botAdmissionOverride.deleteMany({where:{strategyId}});
 await db.strategyRevenueRateVersion.deleteMany({where:{strategyId}});
 await db.bot.deleteMany({where:{strategyId}});
 await db.strategy.deleteMany({where:{id:strategyId}});
 await db.userRole.deleteMany({where:{userId:{in:[actor,owner]},roleId:{in:[superRoleId,botRoleId].filter(Boolean)}}});
 await db.user.deleteMany({where:{id:{in:[actor,owner]}}});
 await db.$disconnect();
}
