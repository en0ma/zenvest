import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {registerHooks} from "node:module";
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="server-only")return nextResolve(new URL("./ci-server-only-shim.mjs",import.meta.url).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("CI database required");
const prisma=new PrismaClient();
const originalEnv={key:process.env.BLOCK_RADAR_API_KEY,wallet:process.env.BLOCK_RADAR_MASTER_WALLET_ID,asset:process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID};
const realFetch=globalThis.fetch;
const {processPendingWithdrawal}=await import("../src/lib/withdrawal-payout-worker.ts");
const userId="ci_payout_worker_user";
let createdUser=false;
try{
 const deposit=await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
 process.env.BLOCK_RADAR_API_KEY="ci-provider-fixture";
 process.env.BLOCK_RADAR_MASTER_WALLET_ID=deposit.walletId;
 process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID="ci-usdc";
 await prisma.user.create({data:{id:userId,name:"CI Payout Worker",email:"ci-payout-worker@example.invalid",passwordHash:"ci-only",unallocated:100000000n}});
 createdUser=true;
 const make=(id,stamp)=>prisma.investorWithdrawal.create({data:{
  id,userId,amountUsdcMicros:5000001n,grossUsdcMicros:7000001n,
  feeUsdcMicros:2000000n,destinationAddress:"11111111111111111111111111111111",
  status:"PENDING",createdAt:new Date(stamp),updatedAt:new Date(stamp)
 }});
 let mode="insufficient",transfers=0;
 globalThis.fetch=async(url,init)=>{
  assert.match(String(url),/^https:\/\/api\.blockradar\.co\/v1\/wallets\//);
  if(String(url).includes("/balance"))return new Response(JSON.stringify({
   statusCode:200,data:{asset:"USDC",balance:mode==="insufficient"?"0.000001":"999999999999.000001"}
  }),{status:200});
  if(String(url).endsWith("/withdraw")){
   transfers++;
   const data=JSON.parse(String(init?.body));
   assert.equal(data.amount,"5.000001");
   assert.equal(data.assetId,"ci-usdc");
   assert.equal(data.address,"11111111111111111111111111111111");
   if(mode==="timeout")throw Error("Simulated provider timeout after network call");
   return new Response(JSON.stringify({data:{id:"ci-provider-accepted",hash:"ci-hash"}}),{status:200});
  }
  throw Error("Unexpected external network request");
 };
 const first=await make("ci_worker_withdrawal_success","1990-01-01T00:00:00Z");
 assert.equal(await processPendingWithdrawal(),"preflight_retry","insufficient master funds cannot trigger a payout");
 assert.equal((await prisma.investorWithdrawal.findUniqueOrThrow({where:{id:first.id}})).status,"PENDING");
 assert.equal(transfers,0);
 mode="success";
 assert.equal(await processPendingWithdrawal(),"submitted","provider acceptance is asynchronous, not final settlement");
 let accepted=await prisma.investorWithdrawal.findUniqueOrThrow({where:{id:first.id}});
 assert.equal(accepted.status,"PROCESSING");
 assert.equal(accepted.providerTransactionId,"ci-provider-accepted");
 assert.equal(accepted.transactionHash,"ci-hash");
 assert.equal(accepted.treasuryTransactionId,null,"provider acceptance cannot mint a completed transfer");
 assert.equal(transfers,1);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated,100000000n,
  "investor's available balance changes only on verified settlement");
 const second=await make("ci_worker_withdrawal_unknown","1991-01-01T00:00:00Z");
 mode="timeout";
 assert.equal(await processPendingWithdrawal(),"review_pending","ambiguous payout response must retain REVIEW hold");
 const unknown=await prisma.investorWithdrawal.findUniqueOrThrow({where:{id:second.id}});
 assert.equal(unknown.status,"REVIEW");
 assert.equal(unknown.failureCode,"PAYOUT_RESPONSE_UNKNOWN");
 assert.equal(unknown.treasuryTransactionId,null);
 assert.equal(transfers,2);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated,100000000n);
 console.log("Withdrawal worker PostgreSQL lifecycle passed: custody preflight, successful provider acceptance, unknown response enters REVIEW, no premature debit");
}finally{
 globalThis.fetch=realFetch;
 for(const [name,value] of [["BLOCK_RADAR_API_KEY",originalEnv.key],["BLOCK_RADAR_MASTER_WALLET_ID",originalEnv.wallet],["BLOCKRADAR_SOLANA_USDC_ASSET_ID",originalEnv.asset]]){
  if(value===undefined)delete process.env[name];else process.env[name]=value;
 }
 await prisma.investorWithdrawal.deleteMany({where:{userId}});
 if(createdUser)await prisma.user.deleteMany({where:{id:userId}});
 await prisma.$disconnect();
}
