import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {registerHooks} from "node:module";
const shim=new URL("./ci-route-runtime-shim.mjs",import.meta.url).href;
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="next/server"||specifier==="@/lib/access")return nextResolve(shim,context);
 if(specifier==="server-only")return nextResolve(new URL("./ci-server-only-shim.mjs",import.meta.url).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",import.meta.url).href,context);
 if(specifier.startsWith("./")&&context.parentURL?.includes("/src/lib/")&&!/\.[cm]?[jt]s$/.test(specifier))return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("Refusing non-CI database");
const prisma=new PrismaClient();
const userId="ci_route_investor",strategyId="ci_route_strategy";
const {POST:allocate}=await import("../src/app/api/earn/allocations/route.ts");
const {POST:deallocate}=await import("../src/app/api/earn/deallocations/route.ts");
const {POST:closePosition}=await import("../src/app/api/earn/positions/close/route.ts");
const {GET:csvReport}=await import("../src/app/api/earn/reports/trade-pnl.csv/route.ts");
const {POST:cancelWithdrawal}=await import("../src/app/api/withdrawals/cancel/route.ts");
const {POST:manualPayout}=await import("../src/app/api/admin/withdrawals/execute/route.ts");
const {POST:activateWallet}=await import("../src/app/api/wallet/activate/route.ts");
function request(body){return new Request("http://ci.local/api/earn/allocations",{method:"POST",headers:{"content-type":"application/json"},body:typeof body==="string"?body:JSON.stringify(body)});}
async function post(body){return allocate(request(body));}
try{
 await prisma.user.create({data:{id:userId,name:"CI Route Investor",email:"ci-route-investor@example.invalid",passwordHash:"ci-fixture-only",unallocated:15000000n}});
 await prisma.strategy.create({data:{
  id:strategyId,name:"CI Route Test Strategy",description:"Route integration fixture",
  isActive:true,isPublic:true,kalshiWalletAddress:"11111111111111111111111111111111",
  minAllocationUsdcMicros:1000000n,maxAllocationUsdcMicros:10000000n,
  availableCapacityUsdcMicros:12000000n
 }});
 assert.equal((await post("{broken-json")).status,400,"invalid JSON must be rejected");
 assert.equal((await post({amount:"1.000000"})).status,400,"strategy is required");
 assert.equal((await post({strategyId,amount:"0"})).status,400,"zero principal forbidden");
 assert.equal((await post({strategyId,amount:"1.0000001"})).status,400,"sub-micro units forbidden");
 assert.equal((await post({strategyId,amount:"-3"})).status,400,"negative principal forbidden");
 const created=await post({strategyId,amount:"8.000001"});
 assert.equal(created.status,201,"valid authenticated investor request must persist");
 const body=await created.json();
 assert.equal(body.status,"PENDING");
 const allocation=await prisma.positionAllocation.findUniqueOrThrow({where:{id:body.operationId}});
 assert.equal(allocation.userId,userId);
 assert.equal(allocation.amountUsdcMicros,8000001n);
 assert.equal(allocation.strategyId,strategyId);
 assert.equal(allocation.status,"PENDING");
 assert.equal((await prisma.investorPosition.findUniqueOrThrow({where:{id:body.positionId}})).userId,userId);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated,15000000n,
  "request must reserve, not debit, until verified settlement");
 assert.equal((await post({strategyId,amount:"5.000000"})).status,409,
  "second request exceeding remaining strategy capacity is rejected");
 assert.equal((await post({strategyId,amount:"8.000000",positionId:"ci_test_position"})).status,409,
  "investor cannot allocate into someone else's position");
 assert.equal(await prisma.positionAllocation.count({where:{userId}}),1,
  "failed requests cannot persist allocation records");
 const increase=await post({strategyId,amount:"1.000000"});
 assert.equal(increase.status,201,"a second allocation to the same market must reuse the open position");
 assert.equal((await increase.json()).positionId,body.positionId,"allocation must not create a second open position");
 assert.equal(await prisma.investorPosition.count({where:{userId,strategyId,status:"OPEN"}}),1);
 await assert.rejects(prisma.investorPosition.create({data:{userId,strategyId,status:"OPEN"}}),
  e=>e.code==="P2002","database uniqueness prevents duplicate open position");

 // Settle the fixture reservations before testing separate deallocation and close workflows.
 await prisma.positionAllocation.updateMany({where:{userId,kind:"ALLOCATE",status:"PENDING"},data:{status:"CANCELLED"}});
 const outside=await prisma.investorPosition.create({data:{userId:"ci_test_user",strategyId,allocatedUsdcMicros:2500000n}});
 const pos=await prisma.investorPosition.update({where:{id:body.positionId},data:{allocatedUsdcMicros:4000000n}});
 const call=(handler,payload)=>handler(new Request("http://ci.local/test",{method:"POST",body:typeof payload==="string"?payload:JSON.stringify(payload)}));
 assert.equal((await call(deallocate,{positionId:outside.id,amount:"1.000000"})).status,409,
  "another investor's position cannot be reduced");
 assert.equal((await call(closePosition,{positionId:outside.id})).status,409,
  "another investor's position cannot be closed");
 assert.equal((await call(deallocate,{positionId:pos.id,amount:"4.000001"})).status,409);
 const response=await call(deallocate,{positionId:pos.id,amount:"2.000001"});
 assert.equal(response.status,201);
 const op=await prisma.positionAllocation.findUniqueOrThrow({where:{id:(await response.json()).operationId}});
 assert.equal(op.userId,userId);
 assert.equal(op.kind,"DEALLOCATE");
 assert.equal(op.amountUsdcMicros,2000001n);
 const second=await call(deallocate,{positionId:pos.id,amount:"1.000000"});
 assert.equal(second.status,201,"multiple reductions may reserve remaining principal");
 const secondId=(await second.json()).operationId;
 assert.equal((await call(deallocate,{positionId:pos.id,amount:"1.000000"})).status,409,
  "reductions cannot exceed equity after existing reservations");
 const increaseDuringReduction=await post({strategyId,amount:"1.000000"});
 assert.equal(increaseDuringReduction.status,201,
  "allocations and reductions may coexist on an open position");
 await prisma.positionAllocation.update({where:{id:(await increaseDuringReduction.json()).operationId},data:{status:"CANCELLED"}});

 assert.equal((await call(closePosition,{positionId:pos.id})).status,409);
 await prisma.positionAllocation.updateMany({where:{id:{in:[op.id,secondId]}},data:{status:"CANCELLED"}});
 const closing=await call(closePosition,{positionId:pos.id});
 assert.equal((await closing.json()).status,"closing");
 assert.equal((await prisma.investorPosition.findUniqueOrThrow({where:{id:pos.id}})).status,"CLOSING");
 assert.equal((await call(deallocate,{positionId:pos.id,amount:"1.000000"})).status,409,"closing positions reject reductions");
 const blockedWhileClosing=await post({strategyId,amount:"1.000000"});
 assert.equal(blockedWhileClosing.status,409,"backend must reject allocations while active position is CLOSING");
 assert.match((await blockedWhileClosing.json()).error,/closing/i);
 assert.equal(await prisma.investorPosition.count({where:{userId,strategyId}}),1,
  "rejected request must not create a second position");

 const zeroStrategyId="ci_route_zero_strategy";
 await prisma.strategy.create({data:{id:zeroStrategyId,name:"CI Route Zero Strategy",description:"Fixture",isActive:true,isPublic:true,kalshiWalletAddress:"11111111111111111111111111111111",minAllocationUsdcMicros:1000000n,maxAllocationUsdcMicros:10000000n,availableCapacityUsdcMicros:12000000n}});
 const zero=await prisma.investorPosition.create({data:{userId,strategyId:zeroStrategyId,allocatedUsdcMicros:0n}});
 assert.equal((await (await call(closePosition,{positionId:zero.id})).json()).status,"closed");
 assert.equal((await prisma.investorPosition.findUniqueOrThrow({where:{id:zero.id}})).status,"CLOSED");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated,15000000n);
 const prevDepositsEnabled=process.env.BLOCKRADAR_DEPOSITS_ENABLED;
 process.env.BLOCKRADAR_DEPOSITS_ENABLED="false";
 assert.equal((await activateWallet()).status,503,"disabled wallet activation must never create custody address");
 if(prevDepositsEnabled===undefined)delete process.env.BLOCKRADAR_DEPOSITS_ENABLED;else process.env.BLOCKRADAR_DEPOSITS_ENABLED=prevDepositsEnabled;
 const payoutResponse=await manualPayout();
 assert.equal(payoutResponse.status,410,"manual payout broadcasting must remain disabled");
 assert.match((await payoutResponse.json()).error,/disabled/);
 const cancelResponse=await cancelWithdrawal();
 assert.equal(cancelResponse.status,410,"investor must not cancel reserved withdrawal");
 assert.match((await cancelResponse.json()).error,/cannot be cancelled/);
 const csvResponse=await csvReport();
 assert.equal(csvResponse.status,200);
 assert.match(csvResponse.headers.get("content-type"),/text\/csv/);
 assert.equal(csvResponse.headers.get("cache-control"),"private, no-store");
 assert.match(await csvResponse.text(),/^settled_utc,position_id,trade_id,market_event,eligible_usdc,gross_pnl_usdc,platform_fee_usdc,net_pnl_usdc\n/);
 assert.equal((await call(deallocate,"{malformed")).status,400);
 assert.equal((await call(deallocate,{positionId:zero.id,amount:"0"})).status,400);
 assert.equal((await call(deallocate,{positionId:zero.id,amount:"0.000001"})).status,409);
 assert.equal((await call(closePosition,"{malformed")).status,400);
 assert.equal((await call(closePosition,{positionId:zero.id})).status,409);
 assert.equal((await (await call(closePosition,{positionId:pos.id})).json()).status,"already_closing");
 console.log("Authenticated-context allocation API source integration passed: validation, real PostgreSQL creation, capacity/ownership rejection, no premature debit");
}finally{
 await prisma.positionAllocation.deleteMany({where:{userId}});
 await prisma.investorPosition.deleteMany({where:{strategyId,userId:"ci_test_user"}});
 await prisma.investorPosition.deleteMany({where:{userId}});
 await prisma.strategy.deleteMany({where:{id:{in:[strategyId,"ci_route_zero_strategy"]}}});
 await prisma.user.deleteMany({where:{id:userId}});
 await prisma.$disconnect();
}
