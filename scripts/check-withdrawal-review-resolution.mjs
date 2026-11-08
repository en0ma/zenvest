import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {registerHooks} from "node:module";
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="server-only")return nextResolve(new URL("./ci-server-only-shim.mjs",import.meta.url).href,context);
 if(specifier==="@/lib/staff-access")return nextResolve(new URL("./ci-kalshi-simulation-access-shim.mjs",import.meta.url).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",import.meta.url).href,context);
 if(specifier.startsWith("./")&&context.parentURL?.includes("/src/lib/")&&!/\.[cm]?[jt]s$/.test(specifier))return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("Disposable CI DB required");
const db=new PrismaClient();
const {POST}=await import("../src/app/api/admin/withdrawals/[id]/resolve-review/route.ts");
const call=id=>POST(new Request("https://ci.invalid/api/admin/withdrawals/"+id+"/resolve-review",{method:"POST"}),{params:Promise.resolve({id})});
const ids=["creviewresolvewaiting00001","creviewresolvenomatch00002","creviewresolvesuccess00003","creviewresolvefailure00004","creviewresolvemismatch0005"];
const originals={key:process.env.BLOCK_RADAR_API_KEY,wallet:process.env.BLOCK_RADAR_MASTER_WALLET_ID,mint:process.env.BLOCKRADAR_SOLANA_USDC_MINT};
const nativeFetch=globalThis.fetch;
let depositBefore,userBefore,feeBefore;
let providerRows=[];
try{
 const deposit=await db.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
 depositBefore=deposit.amount;
 feeBefore=(await db.treasury.findUniqueOrThrow({where:{kind:"WITHDRAWAL_FEE"}})).amount;
 userBefore=(await db.user.findUniqueOrThrow({where:{id:"ci_test_user"}})).unallocated;
 process.env.BLOCK_RADAR_API_KEY="ci-auth-key";
 process.env.BLOCK_RADAR_MASTER_WALLET_ID=deposit.walletId;
 process.env.BLOCKRADAR_SOLANA_USDC_MINT="ci-review-mint";
 const stale=new Date("2000-01-01T00:00:00Z");
 for(const [i,id] of ids.entries()){
  await db.withdrawal.create({data:{id,userId:"ci_test_user",amountUsdcMicros:5_000_000n,
   grossUsdcMicros:7_000_000n,feeUsdcMicros:2_000_000n,status:"REVIEW",
   failureCode:"PAYOUT_RESPONSE_UNKNOWN",destinationAddress:"11111111111111111111111111111111",
   createdAt:i===0?new Date():stale,updatedAt:i===0?new Date():stale}});
 }
 let calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;assert.match(String(url),/\/v1\/wallets\/[^/]+\/transactions\?/);
  assert.equal(options.method,"GET");
  assert.equal(options.headers["x-api-key"],"ci-auth-key");
  return Response.json({data:providerRows,meta:{currentPage:1,totalPages:1}});
 };
 assert.equal((await call(ids[0])).status,409,"review cannot be resolved until two hours old");
 assert.equal(calls,0,"two-hour gate checked before contacting provider");
 assert.equal((await (await call(ids[1])).json()).reason,"not_found");
 assert.equal((await db.withdrawal.findUniqueOrThrow({where:{id:ids[1]}})).status,"REVIEW");
 const result=id=>({id:"provider-"+id,reference:"withdrawal:"+id,type:"WITHDRAW",
  wallet:{id:deposit.walletId},amount:"5.000000",recipientAddress:"11111111111111111111111111111111",
  asset:{symbol:"USDC",decimals:6,address:"ci-review-mint"},network:"testnet",confirmed:true,
  hash:"ci-hash-"+id,status:"SUCCESS"});
 providerRows=[result(ids[2]),{...result(ids[2]),id:"another-provider-id"}];
 assert.equal((await (await call(ids[2])).json()).reason,"ambiguous_reference");
 assert.equal((await db.withdrawal.findUniqueOrThrow({where:{id:ids[2]}})).status,"REVIEW");
 providerRows=[{...result(ids[4]),amount:"999.000000"}];
 const bad=await call(ids[4]);assert.equal((await bad.json()).reason,"mismatch");
 assert.equal((await db.withdrawal.findUniqueOrThrow({where:{id:ids[4]}})).status,"REVIEW");
 providerRows=[result(ids[2])];
 assert.equal((await (await call(ids[2])).json()).outcome,"settled");
 assert.equal((await db.withdrawal.findUniqueOrThrow({where:{id:ids[2]}})).status,"COMPLETED");
 assert.equal((await db.user.findUniqueOrThrow({where:{id:"ci_test_user"}})).unallocated,userBefore-7_000_000n);
 assert.equal((await db.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}})).amount,depositBefore-7_000_000n);
 assert.equal(await db.treasuryTransfer.count({where:{reference:"withdrawal:"+ids[2]}}),1);
 assert.equal((await call(ids[2])).status,409,"terminal payout cannot be retried");
 providerRows=[{...result(ids[3]),status:"FAILED",confirmed:false,hash:null}];
 assert.equal((await (await call(ids[3])).json()).outcome,"settled");
 assert.equal((await db.withdrawal.findUniqueOrThrow({where:{id:ids[3]}})).status,"FAILED");
 assert.equal(await db.treasuryTransfer.count({where:{reference:"withdrawal:"+ids[3]}}),0);
 assert.equal((await db.user.findUniqueOrThrow({where:{id:"ci_test_user"}})).unallocated,userBefore-7_000_000n);
 assert.equal((await db.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}})).amount,depositBefore-7_000_000n);
 console.log("Staff review reconciliation passed: 2h gate, read-only lookup, ambiguity/mismatch held, verified success/failure and replay safety");
}finally{
 globalThis.fetch=nativeFetch;
 for(const [name,value] of [["BLOCK_RADAR_API_KEY",originals.key],["BLOCK_RADAR_MASTER_WALLET_ID",originals.wallet],["BLOCKRADAR_SOLANA_USDC_MINT",originals.mint]])if(value===undefined)delete process.env[name];else process.env[name]=value;
 await db.staffAudit.deleteMany({where:{targetId:{in:ids}}});
 await db.investorActivity.deleteMany({where:{reference:{in:ids.map(id=>"withdrawal:"+id+":completed")}}});
 await db.withdrawal.updateMany({where:{id:{in:ids}},data:{treasuryTransactionId:null}});
 await db.treasuryTransfer.deleteMany({where:{reference:{in:ids.map(id=>"withdrawal:"+id)}}});
 await db.withdrawal.deleteMany({where:{id:{in:ids}}});
 if(userBefore!==undefined)await db.user.update({where:{id:"ci_test_user"},data:{unallocated:userBefore}});
 if(depositBefore!==undefined)await db.treasury.update({where:{kind:"DEPOSIT"},data:{amount:depositBefore}});
 if(feeBefore!==undefined)await db.treasury.update({where:{kind:"WITHDRAWAL_FEE"},data:{amount:feeBefore}});
 await db.$disconnect();
}
