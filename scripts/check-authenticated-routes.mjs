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
 console.log("Authenticated-context allocation API source integration passed: validation, real PostgreSQL creation, capacity/ownership rejection, no premature debit");
}finally{
 await prisma.positionAllocation.deleteMany({where:{userId}});
 await prisma.investorPosition.deleteMany({where:{userId}});
 await prisma.strategy.deleteMany({where:{id:strategyId}});
 await prisma.user.deleteMany({where:{id:userId}});
 await prisma.$disconnect();
}
