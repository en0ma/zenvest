import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {registerHooks} from "node:module";
const shim=new URL("./ci-route-runtime-shim.mjs",import.meta.url).href;
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="next/server")return nextResolve(shim,context);
 if(specifier==="server-only")return nextResolve(new URL("./ci-server-only-shim.mjs",import.meta.url).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",import.meta.url).href,context);
 if(specifier.startsWith("./")&&context.parentURL?.includes("/src/lib/")&&!/\.[cm]?[jt]s$/.test(specifier))return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("CI database required");
const prisma=new PrismaClient();
const prevSecret=process.env.CRON_SECRET;
const secret="ci-cron-secret-only";
const userId="ci_deallocation_coordinator",strategyId="ci_deallocation_coordinator";
const {GET}=await import("../src/app/api/internal/process-position-deallocations/route.ts");
const invoke=auth=>GET(new Request("https://ci.invalid/api/internal/process-position-deallocations",{
 headers:auth?{authorization:"Bearer "+auth}:{}
}));
try{
 process.env.CRON_SECRET=secret;
 assert.equal((await invoke()).status,401);
 assert.equal((await invoke("wrong")).status,401);
 await prisma.user.create({data:{id:userId,email:"ci-deallocation-coordinator@example.invalid",name:"CI Deallocation Coordinator",passwordHash:"test-only"}});
 await prisma.strategy.create({data:{id:strategyId,name:"CI Deallocation Coordinator Strategy",description:"Test-only coordinator lifecycle"}});
 await prisma.strategy.create({data:{id:strategyId+"_empty",name:"CI Deallocation Empty Strategy",description:"Test fixture"}});
 await prisma.strategy.create({data:{id:strategyId+"_pending",name:"CI Deallocation Pending Strategy",description:"Test fixture"}});
 const funded=await prisma.investorPosition.create({data:{
  userId,strategyId,status:"CLOSING",allocatedUsdcMicros:6500001n,lastPnlUpdated:true
 }});
 const empty=await prisma.investorPosition.create({data:{
  userId,strategyId:strategyId+"_empty",status:"CLOSING",allocatedUsdcMicros:0n,lastPnlUpdated:true
 }});
 const pending=await prisma.investorPosition.create({data:{
  userId,strategyId:strategyId+"_pending",status:"CLOSING",allocatedUsdcMicros:1200000n,lastPnlUpdated:true
 }});
 await prisma.positionAllocation.create({data:{userId,strategyId:strategyId+"_pending",positionId:pending.id,kind:"DEALLOCATE",amountUsdcMicros:1200000n,status:"PENDING"}});
 const response=await invoke(secret);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.createdFinalCloseRequests,1);
 assert.equal(data.closedWithoutFunds,1);
 assert.equal((await prisma.investorPosition.findUniqueOrThrow({where:{id:empty.id}})).status,"CLOSED");
 assert.equal((await prisma.investorPosition.findUniqueOrThrow({where:{id:funded.id}})).allocatedUsdcMicros,6500001n);
 const ops=await prisma.positionAllocation.findMany({where:{positionId:funded.id}});
 assert.equal(ops.length,1);
 assert.equal(ops[0].kind,"DEALLOCATE");
 assert.equal(ops[0].amountUsdcMicros,6500001n);
 assert.equal(ops[0].status,"PENDING");
 const again=await invoke(secret);
 assert.equal(again.status,200);
 assert.equal((await again.json()).createdFinalCloseRequests,0);
 assert.equal(await prisma.positionAllocation.count({where:{positionId:funded.id}}),1,
  "replaying close coordinator must never duplicate a final return request");
 console.log("Deallocation coordinator integration passed: cron authorization, final close request, empty position, pending hold and idempotent retries");
}finally{
 if(prevSecret===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=prevSecret;
 await prisma.positionAllocation.deleteMany({where:{strategyId:{startsWith:strategyId}}});
 await prisma.investorPosition.deleteMany({where:{strategyId}});
 await prisma.strategy.deleteMany({where:{id:strategyId}});
 await prisma.user.deleteMany({where:{id:userId}});
 await prisma.$disconnect();
}
