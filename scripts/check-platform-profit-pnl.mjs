import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {registerHooks} from "node:module";
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="server-only")return nextResolve(new URL("./ci-server-only-shim.mjs",import.meta.url).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",import.meta.url).href,context);
 if(specifier.startsWith("./")&&context.parentURL?.includes("/src/lib/")&&!/\.[cm]?[jt]s$/.test(specifier))return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("Disposable CI DB required");
const db=new PrismaClient();
const {processPositionTradePnl}=await import("../src/lib/position-trade-pnl-worker.ts");
const strategyId="ci_platform_profit_strategy";
const userIds=["ci_platform_profit_user_a","ci_platform_profit_user_b"];
const refs=["trade-platform-profit:ci_platform_profit_gain","trade-platform-profit:ci_platform_profit_loss"];
let originalKBank;
try{
 const bank=await db.treasury.findUniqueOrThrow({where:{kind:"K_BANK"}});
 originalKBank=bank.amount;
 await db.strategy.create({data:{id:strategyId,name:"CI Platform Profit Attribution",description:"2-participant fee split",platformProfitPercentage:"20.0000"}});
 for(const [i,id] of userIds.entries()){
  await db.user.create({data:{id,name:"CI PNL "+i,email:"ci-platform-profit-"+i+"@example.invalid",passwordHash:"ci-only"}});
  await db.investorPosition.create({data:{userId:id,strategyId,allocatedUsdcMicros:i===0?6_000_000n:4_000_000n,status:"OPEN"}});
 }
 const createTrade=async id=>db.strategyTrade.create({data:{id,strategyId,marketTradeName:"CI verified P&L",marketTradeId:id,
  marketStart:new Date("2026-01-01T00:00:00.000Z"),status:"AWAITING_ALLOCATION"}});
 const gain=await createTrade("ci_platform_profit_gain");
 let results=await processPositionTradePnl();
 assert.ok(results.includes("prepare:"+gain.id+":ready"),"trade must freeze all eligible participants");
 let rows=await db.positionTradePnl.findMany({where:{strategyTradeId:gain.id}});
 assert.equal(rows.length,2,"both investor allocations participate in the event");
 assert.equal(rows.reduce((n,r)=>n+r.eligibleCapitalUsdcMicros,0n),10_000_000n);
 assert.equal((await db.treasury.findUniqueOrThrow({where:{kind:"K_BANK"}})).amount,originalKBank,
  "snapshot before verified market settlement must not credit profit");
 assert.equal(await db.treasuryTransfer.count({where:{reference:refs[0]}}),0);
 await db.strategyTrade.update({where:{id:gain.id},data:{status:"SETTLED",settledAt:new Date(),realizedPnlUsdcMicros:10_000_000n}});
 results=await processPositionTradePnl();
 assert.ok(results.includes("settle:"+gain.id+":settled"));
 rows=await db.positionTradePnl.findMany({where:{strategyTradeId:gain.id}});
 assert.equal(rows.reduce((n,r)=>n+(r.grossPnlUsdcMicros??0n),0n),10_000_000n);
 assert.equal(rows.reduce((n,r)=>n+(r.platformFeeUsdcMicros??0n),0n),2_000_000n);
 assert.equal(rows.reduce((n,r)=>n+(r.netPnlUsdcMicros??0n),0n),8_000_000n);
 assert.ok(rows.every(r=>r.status==="SETTLED"));
 assert.equal((await db.treasury.findUniqueOrThrow({where:{kind:"K_BANK"}})).amount,originalKBank+2_000_000n);
 const entry=await db.treasuryTransfer.findUniqueOrThrow({where:{reference:refs[0]}});
 assert.equal(entry.direction,"K_BANK_DEPOSIT");assert.equal(entry.status,"COMPLETE");
 assert.equal(entry.amountUsdcMicros,2_000_000n);
 for(const [i,id] of userIds.entries()){
  const position=await db.investorPosition.findFirstOrThrow({where:{userId:id,strategyId}});
  assert.equal(position.allocatedUsdcMicros,i===0?10_800_000n:7_200_000n);
 }
 await processPositionTradePnl();
 assert.equal(await db.treasuryTransfer.count({where:{reference:refs[0]}}),1,"replay must never mint bank profit twice");
 assert.equal((await db.treasury.findUniqueOrThrow({where:{kind:"K_BANK"}})).amount,originalKBank+2_000_000n);
 const loss=await createTrade("ci_platform_profit_loss");
 results=await processPositionTradePnl();
 assert.ok(results.includes("prepare:"+loss.id+":ready"));
 await db.strategyTrade.update({where:{id:loss.id},data:{status:"SETTLED",settledAt:new Date(),realizedPnlUsdcMicros:-5_000_000n}});
 results=await processPositionTradePnl();
 assert.ok(results.includes("settle:"+loss.id+":settled"));
 rows=await db.positionTradePnl.findMany({where:{strategyTradeId:loss.id}});
 assert.equal(rows.reduce((n,r)=>n+(r.grossPnlUsdcMicros??0n),0n),-5_000_000n);
 assert.equal(rows.reduce((n,r)=>n+(r.platformFeeUsdcMicros??0n),0n),0n);
 assert.equal(await db.treasuryTransfer.count({where:{reference:refs[1]}}),0);
 assert.equal((await db.treasury.findUniqueOrThrow({where:{kind:"K_BANK"}})).amount,originalKBank+2_000_000n,
  "loss cannot mint K_BANK profit");
 console.log("Two-participant P&L attribution verified: aggregate fee to K_BANK_DEPOSIT once, replays and losses safe");
}finally{
 await db.treasuryTransfer.deleteMany({where:{reference:{in:refs}}});
 await db.positionTradePnl.deleteMany({where:{strategyTrade:{strategyId}}});
 await db.investorActivity.deleteMany({where:{userId:{in:userIds}}});
 await db.strategyTrade.deleteMany({where:{strategyId}});
 await db.investorPosition.deleteMany({where:{strategyId}});
 await db.strategy.deleteMany({where:{id:strategyId}});
 await db.user.deleteMany({where:{id:{in:userIds}}});
 if(originalKBank!==undefined)await db.treasury.update({where:{kind:"K_BANK"},data:{amount:originalKBank}});
 await db.$disconnect();
}
