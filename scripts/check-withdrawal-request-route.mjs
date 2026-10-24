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
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("CI database required");
const prisma=new PrismaClient();
const {POST}=await import("../src/app/api/withdrawals/route.ts");
const {POST:estimateFee}=await import("../src/app/api/withdrawals/estimate-fee/route.ts");
const previous={enabled:process.env.BLOCKRADAR_WITHDRAWALS_ENABLED,asset:process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID,key:process.env.BLOCK_RADAR_API_KEY,wallet:process.env.BLOCK_RADAR_MASTER_WALLET_ID};
const nativeFetch=globalThis.fetch;
const owner="ci_route_investor";
const address="11111111111111111111111111111111";
const call=data=>POST(new Request("http://ci.local/api/withdrawals",{method:"POST",body:typeof data==="string"?data:JSON.stringify(data)}));
try{
 await prisma.user.create({data:{id:owner,name:"Withdrawal Route CI",email:"ci-route-withdrawal@example.invalid",passwordHash:"ci-only",unallocated:12000000n}});
 process.env.BLOCKRADAR_WITHDRAWALS_ENABLED="true";
 process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID="ci-usdc";
 process.env.BLOCK_RADAR_API_KEY="ci-key";
 process.env.BLOCK_RADAR_MASTER_WALLET_ID="ci-wallet";
 globalThis.fetch=async(url)=>{
  assert.match(String(url),/\/withdraw\/network-fee$/);
  return Response.json({data:{networkFeeInUSD:"0.100000"}});
 };
 const estimate=data=>estimateFee(new Request("http://ci.local/api/withdrawals/estimate-fee",{method:"POST",body:typeof data==="string"?data:JSON.stringify(data)}));
 assert.equal((await estimate("{bad")).status,400);
 assert.equal((await estimate({amount:"0",address})).status,400);
 assert.equal((await estimate({amount:"5.000000",address:"invalid"})).status,400);
 const quote=await estimate({amount:"5.000000",address});
 assert.equal(quote.status,200);
 assert.equal(quote.headers.get("cache-control"),"no-store");
 assert.deepEqual(await quote.json(),{serviceFeeMicros:"2000000",networkFeeMicros:"100000",totalFeeMicros:"2100000",netMicros:"2900000"});
 assert.equal((await call("{bad")).status,400);
 assert.equal((await call({amount:"0",address})).status,400);
 assert.equal((await call({amount:"2.000000",address})).status,400);
 assert.equal((await call({amount:"5.000000",address:"invalid"})).status,400);
 assert.equal((await call({amount:"5.000000",address,maxTotalFeeMicros:"2000000"})).status,409);
 const success=await call({amount:"5.000000",address,maxTotalFeeMicros:"2100000"});
 assert.equal(success.status,201);
 const body=await success.json();
 assert.equal(body.status,"PENDING");
 assert.equal(body.gross,"5000000");
 assert.equal(body.net,"2900000");
 assert.equal(body.fee,"2100000");
 const row=await prisma.investorWithdrawal.findUniqueOrThrow({where:{id:body.id}});
 assert.equal(row.userId,owner);
 assert.equal(row.treasuryTransactionId,null);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:owner}})).unallocated,12000000n);
 assert.equal((await call({amount:"8.000000",address,maxTotalFeeMicros:"2100000"})).status,409,
  "pending withdrawal reserves gross funds");
 assert.equal(await prisma.investorWithdrawal.count({where:{userId:owner}}),1);
 // Fee-quote provider failure cannot persist a withdrawal.
 const requestsBefore=await prisma.investorWithdrawal.count({where:{userId:owner}});
 globalThis.fetch=async()=>new Response("upstream unavailable",{status:503});
 assert.equal((await call({amount:"3.000000",address,maxTotalFeeMicros:"3000000"})).status,503);
 assert.equal(await prisma.investorWithdrawal.count({where:{userId:owner}}),requestsBefore);
 globalThis.fetch=async()=>Response.json({data:{networkFeeInUSD:"0.100000"}});
 // Disable guard must not contact Blockradar or mutate investor balances.
 process.env.BLOCKRADAR_WITHDRAWALS_ENABLED="false";
 globalThis.fetch=async()=>{throw Error("Unexpected disabled provider call");};
 assert.equal((await call({amount:"3.000000",address,maxTotalFeeMicros:"3000000"})).status,503);
 assert.equal(await prisma.investorWithdrawal.count({where:{userId:owner}}),requestsBefore);
 console.log("Withdrawal route source coverage passed: validation, fee acceptance, successful request, reserved balance and insufficient available funds");
}finally{
 globalThis.fetch=nativeFetch;
 for(const [key,value] of [["BLOCKRADAR_WITHDRAWALS_ENABLED",previous.enabled],["BLOCKRADAR_SOLANA_USDC_ASSET_ID",previous.asset],["BLOCK_RADAR_API_KEY",previous.key],["BLOCK_RADAR_MASTER_WALLET_ID",previous.wallet]])if(value===undefined)delete process.env[key];else process.env[key]=value;
 await prisma.investorActivity.deleteMany({where:{userId:owner}});
 await prisma.investorWithdrawal.deleteMany({where:{userId:owner}});
 await prisma.user.deleteMany({where:{id:owner}});
 await prisma.$disconnect();
}
