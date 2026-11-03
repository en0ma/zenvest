import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {registerHooks} from "node:module";
const here=new URL(".",import.meta.url);
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="next/server")return nextResolve(new URL("ci-route-runtime-shim.mjs",here).href,context);
 if(specifier==="server-only")return nextResolve(new URL("ci-server-only-shim.mjs",here).href,context);
 if(specifier==="@/lib/staff-access")return nextResolve(new URL("ci-platform-access-shim.mjs",here).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",here).href,context);
 if(specifier.startsWith("./")&&context.parentURL?.includes("/src/lib/")&&!/\.[cm]?[jt]s$/.test(specifier))return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("Disposable CI database required");
const prisma=new PrismaClient();
const {POST:reserve}=await import("../src/app/api/admin/actions/[id]/platform-withdrawal/route.ts");
const {processPendingPlatformWithdrawal}=await import("../src/lib/platform-withdrawal-worker.ts");
const {processVerifiedBlockradarQueueItem}=await import("../src/lib/blockradar-webhook-processing.ts");
const {platformWithdrawalReference}=await import("../src/lib/blockradar-payout.ts");
const saved={...process.env},realFetch=globalThis.fetch;
const ids=["ci-platform-action-success","ci-platform-action-failed","ci-platform-action-unknown"];
const addr="11111111111111111111111111111111";
let initialBuckets=[],created=[];
const call=(id)=>reserve(new Request("https://ci.invalid/api/admin/actions/"+id+"/platform-withdrawal",{method:"POST"}),{params:Promise.resolve({id})});
const signed=async(event,data,key)=>{
 const raw=JSON.stringify({event,data});
 return processVerifiedBlockradarQueueItem(new Request("https://ci.invalid/api/internal/verified-blockradar",{method:"POST",body:raw,headers:{"x-blockradar-signature":createHmac("sha512",key).update(raw).digest("hex")}}));
};
try{
 const master=await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
 initialBuckets=await prisma.treasury.findMany({where:{kind:{in:["M_BANK","DEPOSIT_FEE","WITHDRAWAL_FEE"]}},select:{kind:true,amount:true}});
 // Give disposable CI a controlled platform-only float; restore on exit.
 for(const kind of ["M_BANK","DEPOSIT_FEE","WITHDRAWAL_FEE"])
  await prisma.treasury.update({where:{kind},data:{amount:15000000n}});
 const investorBefore=(await prisma.user.findUniqueOrThrow({where:{id:"ci_test_user"}})).unallocated;
 process.env.BLOCK_RADAR_API_KEY="ci-platform-secret";
 process.env.BLOCK_RADAR_MASTER_WALLET_ID=master.walletId;
 process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID="ci-usdc";
 process.env.BLOCKRADAR_SOLANA_USDC_MINT="ci-mint";
 process.env.STAFF_WALLET_TRANSFER_LIMIT_MICROS="50000000";
 process.env.STAFF_PLATFORM_WITHDRAWALS_ENABLED="false";
 for(const id of ids)await prisma.staffAction.create({data:{id,resource:"wallets",operation:"operate",targetId:master.id,reason:"CI independently approved platform withdrawal",idempotencyKey:id+"-key",requestedBy:"ci-maker",decidedBy:"ci-checker",status:"APPROVED",payload:{kind:"MASTER_TO_WALLET",amountUsdcMicros:"5000001",destinationAddress:addr}}});
 assert.equal((await call(ids[0])).status,503);
 process.env.STAFF_PLATFORM_WITHDRAWALS_ENABLED="true";
 let response=await call(ids[0]);
 assert.equal(response.status,201,JSON.stringify(await response.clone().json()));
 const firstId=(await response.json()).id;created.push(firstId);
 assert.equal((await call(ids[0])).status,409,"cannot consume an approval twice");
 const reserved=await prisma.platformWithdrawal.findUniqueOrThrow({where:{id:firstId}});
 assert.equal(reserved.status,"PENDING");
 assert.equal(reserved.reservedMBankMicros+reserved.reservedDepositFeeMicros+reserved.reservedWithdrawalFeeMicros,5000001n);
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"M_BANK"}})).amount,9999999n);
 let submissions=0,mode="accepted",receiptId="ci-platform-provider-success";
 globalThis.fetch=async(url,init)=>{
  if(String(url).includes("/balance"))return Response.json({statusCode:200,data:{asset:"USDC",balance:"999999999999.000001"}});
  if(String(url).endsWith("/withdraw")){
   submissions++;const body=JSON.parse(String(init?.body));
   assert.equal(body.reference,platformWithdrawalReference(created.at(-1)));
   assert.equal(body.address,addr);assert.equal(body.amount,"5.000001");assert.equal(body.metadata.source_type,"platform");
   if(mode==="timeout")throw Error("Unknown provider result");
   return Response.json({data:{id:receiptId,hash:"ci-accepted-hash"}});
  }
  throw Error("Unexpected provider request");
 };
 assert.equal(await processPendingPlatformWithdrawal(firstId),"submitted");
 assert.equal((await prisma.platformWithdrawal.findUniqueOrThrow({where:{id:firstId}})).status,"PROCESSING");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:"ci_test_user"}})).unallocated,investorBefore);
 const envelope=(id,provider,status)=>({id:provider,reference:platformWithdrawalReference(id),amount:"5.000001",recipientAddress:addr,wallet:{id:master.walletId},type:"WITHDRAW",status,network:"testnet",asset:{symbol:"USDC",decimals:6,address:"ci-mint"},hash:"ci-confirmed-hash",confirmed:true});
 const success=envelope(firstId,receiptId,"SUCCESS");
 assert.equal((await signed("withdraw.success",{...success,recipientAddress:"wrong"},process.env.BLOCK_RADAR_API_KEY)).status,200);
 assert.equal((await prisma.platformWithdrawal.findUniqueOrThrow({where:{id:firstId}})).status,"PROCESSING","mismatched recipient must never settle");
 assert.equal((await signed("withdraw.success",success,"wrong-secret")).status,401,"signature required");
 assert.equal((await signed("withdraw.success",success,process.env.BLOCK_RADAR_API_KEY)).status,200);
 assert.equal((await prisma.platformWithdrawal.findUniqueOrThrow({where:{id:firstId}})).status,"COMPLETED");
 assert.equal(await prisma.treasuryTransfer.count({where:{reference:platformWithdrawalReference(firstId)}}),1);
 assert.equal((await signed("withdraw.success",success,process.env.BLOCK_RADAR_API_KEY)).status,200);
 assert.equal(await prisma.treasuryTransfer.count({where:{reference:platformWithdrawalReference(firstId)}}),1,"callback replay cannot create duplicate ledger entry");
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"M_BANK"}})).amount,9999999n,"success does not double-debit reserved source");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:"ci_test_user"}})).unallocated,investorBefore);
 response=await call(ids[1]);assert.equal(response.status,201);
 const failedId=(await response.json()).id;created.push(failedId);
 receiptId="ci-platform-provider-failed";
 assert.equal(await processPendingPlatformWithdrawal(failedId),"submitted");
 const failed=envelope(failedId,receiptId,"FAILED");
 assert.equal((await signed("withdraw.failed",failed,process.env.BLOCK_RADAR_API_KEY)).status,200);
 assert.equal((await prisma.platformWithdrawal.findUniqueOrThrow({where:{id:failedId}})).status,"FAILED");
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"M_BANK"}})).amount,9999999n,"authenticated provider failure releases reservation exactly once");
 assert.equal((await signed("withdraw.failed",failed,process.env.BLOCK_RADAR_API_KEY)).status,200);
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"M_BANK"}})).amount,9999999n);
 response=await call(ids[2]);assert.equal(response.status,201);
 const unknownId=(await response.json()).id;created.push(unknownId);
 mode="timeout";
 assert.equal(await processPendingPlatformWithdrawal(unknownId),"review_pending");
 assert.equal((await prisma.platformWithdrawal.findUniqueOrThrow({where:{id:unknownId}})).status,"REVIEW");
 assert.equal(await processPendingPlatformWithdrawal(unknownId),"already_claimed","unknown payout must never be resubmitted");
 assert.equal(submissions,3,"exactly one request per durable platform withdrawal");
 console.log("Platform treasury reservations, Blockradar dispatch and HMAC-verified replay-safe settlement passed");
}finally{
 globalThis.fetch=realFetch;
 await prisma.treasuryTransfer.deleteMany({where:{reference:{startsWith:"platform_withdrawal:"}}});
 await prisma.staffAudit.deleteMany({where:{targetId:{in:created}}});
 await prisma.platformWithdrawal.deleteMany({where:{staffActionId:{in:ids}}});
 await prisma.staffAction.deleteMany({where:{id:{in:ids}}});
 for(const row of initialBuckets)await prisma.treasury.update({where:{kind:row.kind},data:{amount:row.amount}});
 await prisma.$disconnect();
 for(const key of ["BLOCK_RADAR_API_KEY","BLOCK_RADAR_MASTER_WALLET_ID","BLOCKRADAR_SOLANA_USDC_ASSET_ID","BLOCKRADAR_SOLANA_USDC_MINT","STAFF_PLATFORM_WITHDRAWALS_ENABLED","STAFF_WALLET_TRANSFER_LIMIT_MICROS"]){
  if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];
 }
}
