import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {registerHooks} from "node:module";
const here=new URL(".",import.meta.url);
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="next/server")return nextResolve(new URL("ci-route-runtime-shim.mjs",here).href,context);
 if(specifier==="server-only")return nextResolve(new URL("ci-server-only-shim.mjs",here).href,context);
 if(specifier==="@/lib/staff-access")return nextResolve(new URL("ci-kalshi-simulation-access-shim.mjs",here).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",here).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("CI database required");
const db=new PrismaClient();
const {POST}=await import("../src/app/api/admin/actions/[id]/kalshi-withdrawal/route.ts");
const {confirmVerifiedStaffKalshiWithdrawal}=await import("../src/lib/staff-kalshi-withdrawal-confirmation.ts");
const {processVerifiedBlockradarQueueItem}=await import("../src/lib/blockradar-webhook-processing.ts");
const ids=["ci-kalshi-sim-valid","ci-kalshi-sim-unapproved","ci-kalshi-sim-excess","ci-kalshi-sim-injected"];
const strategyId="ci_staff_kalshi_sim_strategy";
const saved=Object.fromEntries(["STAFF_KALSHI_WITHDRAWALS_ENABLED","BLOCK_RADAR_API_KEY","BLOCK_RADAR_MASTER_WALLET_ID","BLOCKRADAR_SOLANA_USDC_MINT","BLOCKRADAR_DEPOSITS_ENABLED"].map(key=>[key,process.env[key]]));
const call=id=>POST(new Request("https://ci.invalid/api/admin/actions/"+id+"/kalshi-withdrawal",{method:"POST"}),{params:Promise.resolve({id})});
let initialBank,initialMaster,initialMBank,initialMBankAddress,createdStrategy=false;
try{
 const master=await db.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
 initialMaster={walletAddress:master.walletAddress};
 const bank=await db.treasury.findUniqueOrThrow({where:{kind:"K_BANK"}});
 initialBank=bank.amount;
 const mBank=await db.treasury.findUniqueOrThrow({where:{kind:"M_BANK"}});
 initialMBank=mBank.amount;
 initialMBankAddress=mBank.walletAddress;
 const properMaster="11111111111111111111111111111111";
 const strategyDeposit="22222222222222222222222222222222";
 const strategyAddressId="ci-staff-strategy-deposit-address";
 await db.treasury.update({where:{kind:"DEPOSIT"},data:{walletAddress:properMaster}});
 await db.treasury.update({where:{kind:"M_BANK"},data:{walletAddress:properMaster,walletId:master.walletId}});
 await db.treasury.update({where:{kind:"K_BANK"},data:{amount:20_000_000n}});
 await db.strategy.create({data:{id:strategyId,name:"CI Admin Kalshi Withdrawal",description:"Simulated no-custody Kalshi return fixture",kalshiWalletAddress:properMaster,blockRadarAddress:strategyDeposit,blockRadarAddressId:strategyAddressId}});
 createdStrategy=true;
 process.env.BLOCK_RADAR_API_KEY="ci-kalshi-mock-only";
 process.env.BLOCK_RADAR_MASTER_WALLET_ID=master.walletId;
 process.env.BLOCKRADAR_SOLANA_USDC_MINT="ci-mint";
 process.env.BLOCKRADAR_DEPOSITS_ENABLED="false";
 process.env.STAFF_KALSHI_WITHDRAWALS_ENABLED="false";
 for(const id of ids){
  await db.staffAction.create({data:{id,resource:"wallets",operation:"operate",
   targetId:strategyId,requestedBy:"ci-maker",decidedBy:id===ids[1]?"ci-maker":"ci-checker",
   status:"APPROVED",reason:"CI tested withdrawal-only platform return",idempotencyKey:id+"-key",
   payload:id===ids[3]?{kind:"KALSHI_TO_MASTER",amountUsdcMicros:"5000000",destinationAddress:properMaster}:
    {kind:"KALSHI_TO_MASTER",amountUsdcMicros:id===ids[2]?"21000000":"5000000"}
  }});
 }
 const investorBefore=(await db.user.findUniqueOrThrow({where:{id:"ci_test_user"}})).unallocated;
 assert.equal((await call(ids[0])).status,503,"off by default");
 process.env.STAFF_KALSHI_WITHDRAWALS_ENABLED="true";
 assert.equal((await call(ids[1])).status,409,"self-approval denied");
 assert.equal((await call(ids[2])).status,409,"mock amount cannot exceed K_BANK");
 assert.equal((await call(ids[3])).status,422,"cannot inject destination");
 const approved=await call(ids[0]);
 assert.equal(approved.status,200,JSON.stringify(await approved.clone().json()));
 const result=await approved.json();
 assert.equal(result.status,"PROCESSING");
 assert.equal(result.execution,"ACCEPTED_PROCESSING");
 assert.equal(result.settled,false);
 const record=await db.staffKalshiWithdrawal.findUniqueOrThrow({where:{staffActionId:ids[0]}});
 assert.equal(record.providerWithdrawalId,"mock-withdrawal:"+record.id,"must reuse investor mock adapter");
 assert.equal(record.masterWalletAddress,properMaster,"cannot redirect mock to another destination");
 assert.equal(record.status,"PROCESSING");
 assert.equal(await db.staffKalshiWithdrawal.count({where:{staffActionId:ids[0]}}),1);
 assert.equal((await call(ids[0])).status,409,"consumed approval is one-shot");
 assert.equal((await db.treasury.findUniqueOrThrow({where:{kind:"K_BANK"}})).amount,20_000_000n);
 assert.equal((await db.treasury.findUniqueOrThrow({where:{kind:"M_BANK"}})).amount,initialMBank,"withdrawal cannot credit M_BANK");
 assert.equal((await db.user.findUniqueOrThrow({where:{id:"ci_test_user"}})).unallocated,investorBefore);
 assert.equal(await db.treasuryTransfer.count({where:{reference:{startsWith:"kalshi_staff_withdrawal:"}}}),0);
 const sendSweep=async(receiptId,amount="5.000000",secret=process.env.BLOCK_RADAR_API_KEY)=>{
  const data={
   id:receiptId,reference:"staff-kalshi:"+record.id,recipientAddress:strategyDeposit,
   address:{id:strategyAddressId,address:strategyDeposit},
   wallet:{id:master.walletId,address:properMaster},
   amountPaid:amount,amount,hash:"ci-staff-kalshi-hash",confirmed:true,status:"SUCCESS",type:"DEPOSIT",
   network:"testnet",asset:{symbol:"USDC",address:"ci-mint",decimals:6},
   assetSwept:true,assetSweptAmount:amount,assetSweptHash:"ci-staff-sweep-hash",
   assetSweptSenderAddress:strategyDeposit,assetSweptRecipientAddress:properMaster,
   metadata:{source_type:"strategy",staff_kalshi_withdrawal_id:record.id},
  };
  const raw=JSON.stringify({event:"deposit.swept.success",data});
  const signature=createHmac("sha512",secret).update(raw).digest("hex");
  return processVerifiedBlockradarQueueItem(new Request("https://ci.invalid/internal/blockradar",{
   method:"POST",body:raw,headers:{"x-blockradar-signature":signature},
  }));
 };
 assert.equal((await sendSweep("ci-staff-receipt-before-source")).status,503,"mock 200 cannot settle source-unconfirmed transfer");
 assert.equal((await sendSweep("ci-staff-receipt-bad-signature","5.000000","invalid")).status,401);
 assert.equal(await confirmVerifiedStaffKalshiWithdrawal({
  withdrawalId:record.id,providerWithdrawalId:record.providerWithdrawalId,
  amountUsdcMicros:5000000n,strategyWalletAddress:properMaster
 }),"invalid","mock provider ID is not valid source proof");
 assert.equal(await confirmVerifiedStaffKalshiWithdrawal({
  withdrawalId:record.id,providerWithdrawalId:"kalshi-verified-"+record.id,
  amountUsdcMicros:6000000n,strategyWalletAddress:properMaster
 }),"mismatch","authenticated source amount must match");
 const verifiedId="kalshi-verified-"+record.id;
 assert.equal(await confirmVerifiedStaffKalshiWithdrawal({
  withdrawalId:record.id,providerWithdrawalId:verifiedId,
  amountUsdcMicros:5000000n,strategyWalletAddress:properMaster
 }),"confirming");
 assert.equal(await confirmVerifiedStaffKalshiWithdrawal({
  withdrawalId:record.id,providerWithdrawalId:verifiedId,
  amountUsdcMicros:5000000n,strategyWalletAddress:properMaster
 }),"duplicate");
 assert.equal((await sendSweep("ci-staff-receipt-wrong-amount","4.000000")).status,503,"wrong sweep amount cannot settle");
 assert.equal((await db.treasury.findUniqueOrThrow({where:{kind:"M_BANK"}})).amount,initialMBank);
 assert.equal((await sendSweep("ci-staff-receipt-confirmed")).status,200);
 const completed=await db.staffKalshiWithdrawal.findUniqueOrThrow({where:{id:record.id}});
 assert.equal(completed.status,"COMPLETED");
 assert.equal(completed.sourceConfirmed,true);
 assert.equal(completed.destinationConfirmed,true);
 assert.equal(completed.masterReceiptId,"ci-staff-receipt-confirmed");
 assert.equal((await db.treasury.findUniqueOrThrow({where:{kind:"K_BANK"}})).amount,15_000_000n);
 assert.equal((await db.treasury.findUniqueOrThrow({where:{kind:"M_BANK"}})).amount,initialMBank+5000000n);
 const ledger=await db.treasuryTransfer.findUniqueOrThrow({where:{reference:"platform_kalshi_return:"+record.id}});
 assert.equal(ledger.direction,"PLATFORM_K_BANK");
 assert.equal(ledger.amountUsdcMicros,5000000n);
 assert.equal(ledger.originExternalId,verifiedId);
 assert.equal(ledger.destinationExternalId,"ci-staff-receipt-confirmed");
 assert.equal(await db.treasuryTransfer.count({where:{reference:"platform_kalshi_return:"+record.id}}),1);
 assert.equal((await sendSweep("ci-staff-receipt-confirmed")).status,200,"signed sweep must be replay-safe");
 assert.equal((await db.treasury.findUniqueOrThrow({where:{kind:"K_BANK"}})).amount,15_000_000n);
 assert.equal((await db.treasury.findUniqueOrThrow({where:{kind:"M_BANK"}})).amount,initialMBank+5000000n);
 assert.equal((await db.user.findUniqueOrThrow({where:{id:"ci_test_user"}})).unallocated,investorBefore);

 console.log("Admin Kalshi withdrawal passed: mocked HTTP acceptance never settles; verified source + HMAC-signed Blockradar sweep moves only K_BANK to M_BANK and creates exactly one PLATFORM_K_BANK ledger entry");
}finally{
 await db.treasuryTransfer.deleteMany({where:{reference:{startsWith:"platform_kalshi_return:"}}});
 await db.staffAudit.deleteMany({where:{targetId:{in:ids}}});
 const sims=await db.staffKalshiWithdrawal.findMany({where:{staffActionId:{in:ids}},select:{id:true}});
 await db.staffAudit.deleteMany({where:{targetId:{in:sims.map(s=>s.id)}}});
 await db.staffKalshiWithdrawal.deleteMany({where:{staffActionId:{in:ids}}});
 await db.staffAction.deleteMany({where:{id:{in:ids}}});
 if(createdStrategy)await db.strategy.deleteMany({where:{id:strategyId}});
 if(initialBank!==undefined)await db.treasury.update({where:{kind:"K_BANK"},data:{amount:initialBank}});
 if(initialMBank!==undefined)await db.treasury.update({where:{kind:"M_BANK"},data:{amount:initialMBank,walletAddress:initialMBankAddress}});
 if(initialMaster)await db.treasury.update({where:{kind:"DEPOSIT"},data:{walletAddress:initialMaster.walletAddress}});
 await db.$disconnect();
 for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value}
}
