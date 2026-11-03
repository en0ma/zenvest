import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {registerHooks} from "node:module";
const here=new URL(".",import.meta.url);
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="server-only")return nextResolve(new URL("ci-server-only-shim.mjs",here).href,context);
 if(specifier==="@/lib/staff-access")return nextResolve(new URL("ci-kalshi-withdrawal-access-shim.mjs",here).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",here).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("CI database required");
const db=new PrismaClient();
const {POST}=await import("../src/app/api/admin/actions/[id]/kalshi-withdrawal/route.ts");
const ids=["ci-kalshi-sim-valid","ci-kalshi-sim-unapproved","ci-kalshi-sim-excess","ci-kalshi-sim-injected"];
const strategyId="ci_staff_kalshi_sim_strategy";
const saved=Object.fromEntries(["STAFF_KALSHI_WITHDRAWALS_ENABLED","STAFF_WALLET_TRANSFER_LIMIT_MICROS","BLOCK_RADAR_API_KEY","BLOCK_RADAR_MASTER_WALLET_ID"].map(key=>[key,process.env[key]]));
const call=id=>POST(new Request("https://ci.invalid/api/admin/actions/"+id+"/kalshi-withdrawal",{method:"POST"}),{params:Promise.resolve({id})});
let initialBank,initialMaster,initialMBank,createdStrategy=false;
try{
 const master=await db.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
 initialMaster={walletAddress:master.walletAddress};
 const bank=await db.treasury.findUniqueOrThrow({where:{kind:"K_BANK"}});
 initialBank=bank.amount;
 initialMBank=(await db.treasury.findUniqueOrThrow({where:{kind:"M_BANK"}})).amount;
 const properMaster="11111111111111111111111111111111";
 await db.treasury.update({where:{kind:"DEPOSIT"},data:{walletAddress:properMaster}});
 await db.treasury.update({where:{kind:"K_BANK"},data:{amount:20_000_000n}});
 await db.strategy.create({data:{id:strategyId,name:"CI Admin Kalshi Withdrawal",description:"Simulated no-custody Kalshi return fixture",kalshiWalletAddress:properMaster}});
 createdStrategy=true;
 process.env.BLOCK_RADAR_API_KEY="ci-kalshi-mock-only";
 process.env.BLOCK_RADAR_MASTER_WALLET_ID=master.walletId;
 process.env.STAFF_WALLET_TRANSFER_LIMIT_MICROS="30000000";
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
 console.log("Admin Kalshi withdrawal passed: one-shot approved claim, existing mock adapter, master-only destination, no K_BANK/M_BANK/ledger/user mutation");
}finally{
 await db.staffAudit.deleteMany({where:{targetId:{in:ids}}});
 const sims=await db.staffKalshiWithdrawal.findMany({where:{staffActionId:{in:ids}},select:{id:true}});
 await db.staffAudit.deleteMany({where:{targetId:{in:sims.map(s=>s.id)}}});
 await db.staffKalshiWithdrawal.deleteMany({where:{staffActionId:{in:ids}}});
 await db.staffAction.deleteMany({where:{id:{in:ids}}});
 if(createdStrategy)await db.strategy.deleteMany({where:{id:strategyId}});
 if(initialBank!==undefined)await db.treasury.update({where:{kind:"K_BANK"},data:{amount:initialBank}});
 if(initialMaster)await db.treasury.update({where:{kind:"DEPOSIT"},data:{walletAddress:initialMaster.walletAddress}});
 await db.$disconnect();
 for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value}
}
