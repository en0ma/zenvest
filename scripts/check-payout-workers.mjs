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
const {processPendingAllocations}=await import("../src/lib/allocation-payout-worker.ts");
const strategyId="ci_worker_allocation";
const walletAddress="11111111111111111111111111111111";
let positionId=null,allocationId=null,eventId=null;
try{
 const deposit=await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
 process.env.BLOCK_RADAR_API_KEY="ci-provider-fixture";
 process.env.BLOCK_RADAR_MASTER_WALLET_ID=deposit.walletId;
 process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID="ci-usdc";
 await prisma.strategy.create({data:{id:strategyId,name:"CI Payout Worker Strategy",description:"Isolated payout worker lifecycle test",kalshiWalletAddress:walletAddress}});
 const position=await prisma.investorPosition.create({data:{userId:"ci_test_user",strategyId}});
 positionId=position.id;
 const pending=await prisma.positionAllocation.create({data:{
   userId:"ci_test_user",positionId,strategyId,kind:"ALLOCATE",
   amountUsdcMicros:1500001n,status:"PENDING",createdAt:new Date("2000-01-01T00:00:00.000Z")
 }});
 allocationId=pending.id;
 let transfers=0,balances=0;
 let mode="insufficient";
 globalThis.fetch=async(url,init)=>{
  assert.match(String(url),/^https:\/\/api\.blockradar\.co\/v1\/wallets\//);
  if(String(url).includes("/balance")){
   balances++;
   return new Response(JSON.stringify({statusCode:200,data:{asset:"USDC",balance:mode==="insufficient"?"0.000001":"999999999999.000001"}}),{status:200});
  }
  if(String(url).endsWith("/withdraw")){
   transfers++;
   const data=JSON.parse(String(init?.body));
   assert.equal(data.amount,"1.500001");
   assert.equal(data.address,walletAddress);
   assert.equal(data.assetId,"ci-usdc");
   assert.match(data.reference,/^strategy_withdrawal:/);
   if(mode==="timeout")throw Error("Simulated provider timeout");
   return new Response(JSON.stringify({data:{id:"ci-provider-acceptance"}}),{status:200});
  }
  throw Error("Unexpected external HTTP");
 };
 const before=await prisma.user.findUniqueOrThrow({where:{id:"ci_test_user"}});
 assert.equal(await processPendingAllocations(),"preflight_retry","insufficient custody must release the unsubmitted claim");
 let after=await prisma.positionAllocation.findUniqueOrThrow({where:{id:allocationId}});
 assert.equal(after.status,"PENDING");
 assert.equal(after.strategyEventId,null);
 assert.equal(transfers,0,"insufficient custody must not issue a transfer");
 mode="success";
 assert.equal(await processPendingAllocations(),"submitted","verified custody should submit one allocation");
 after=await prisma.positionAllocation.findUniqueOrThrow({where:{id:allocationId}});
 assert.equal(after.status,"PROCESSING");
 assert.ok(after.strategyEventId);
 eventId=after.strategyEventId;
 const event=await prisma.strategyEvent.findUniqueOrThrow({where:{id:eventId}});
 assert.equal(event.status,"PROCESSING");
 assert.equal(event.amountUsdcMicros,1500001n);
 assert.equal(event.treasuryTransactionId,null,"submission alone must never create a settled treasury transfer");
 assert.equal(event.sourceConfirmed,false);
 assert.equal(event.destinationConfirmed,false);
 assert.equal(transfers,1);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:"ci_test_user"}})).unallocated,before.unallocated,
  "unconfirmed allocation cannot move investor funds");
 assert.equal(await processPendingAllocations(),"empty","submitted transfer cannot be re-sent");
 assert.equal(transfers,1);
 console.log("Allocation worker PostgreSQL lifecycle passed: insufficient custody retry, successful provider acceptance, no premature settlement, no resubmission");
}finally{
 globalThis.fetch=realFetch;
 for(const [name,value] of [["BLOCK_RADAR_API_KEY",originalEnv.key],["BLOCK_RADAR_MASTER_WALLET_ID",originalEnv.wallet],["BLOCKRADAR_SOLANA_USDC_ASSET_ID",originalEnv.asset]]){
  if(value===undefined)delete process.env[name];else process.env[name]=value;
 }
 if(allocationId)await prisma.positionAllocation.deleteMany({where:{id:allocationId}});
 if(eventId)await prisma.strategyEvent.deleteMany({where:{id:eventId}});
 if(positionId)await prisma.investorPosition.deleteMany({where:{id:positionId}});
 await prisma.strategy.deleteMany({where:{id:strategyId}});
 await prisma.$disconnect();
}
