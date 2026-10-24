import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {registerHooks} from "node:module";

const shim=new URL("./ci-route-runtime-shim.mjs",import.meta.url).href;
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="next/server")return nextResolve(shim,context);
 if(specifier==="server-only")return nextResolve(new URL("./ci-server-only-shim.mjs",import.meta.url).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",import.meta.url).href,context);
 if(specifier.startsWith("./")&&context.parentURL?.includes("/src/lib/")&&!/\.[cm]?[jt]s$/.test(specifier))return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("Disposable CI database required");
const names=["BLOCK_RADAR_API_KEY","BLOCK_RADAR_MASTER_WALLET_ID","BLOCKRADAR_DEPOSITS_ENABLED","BLOCKRADAR_SOLANA_USDC_MINT"];
const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
const secret="ci-verified-webhook-secret";
const {processVerifiedBlockradarQueueItem:handle}=await import("../src/lib/blockradar-webhook-processing.ts");
const request=(raw,signature)=>new Request("https://ci.invalid/internal/verified-blockradar",{
 method:"POST",body:raw,headers:{"x-blockradar-signature":signature??createHmac("sha512",secret).update(raw).digest("hex")}
});
const call=payload=>handle(request(JSON.stringify(payload)));
try{
 delete process.env.BLOCK_RADAR_API_KEY;
 assert.equal((await call({event:"test"})).status,503,"missing custody credentials fail closed");
 process.env.BLOCK_RADAR_API_KEY=secret;
 process.env.BLOCK_RADAR_MASTER_WALLET_ID="ci-verified-master";
 process.env.BLOCKRADAR_DEPOSITS_ENABLED="true";
 process.env.BLOCKRADAR_SOLANA_USDC_MINT="ci-verified-mint";
 assert.equal((await handle(request("{}", "invalid"))).status,401,"invalid signature cannot reach settlement");
 assert.equal((await handle(request("{broken"))).status,400,"signed invalid JSON rejected");
 assert.equal((await handle(request("null"))).status,400,"invalid envelope rejected");
 process.env.BLOCKRADAR_DEPOSITS_ENABLED="false";
 assert.equal((await call({event:"deposit.success",data:{}})).status,503,"disabled deposit processing must fail closed");
 process.env.BLOCKRADAR_DEPOSITS_ENABLED="true";
 assert.equal((await call({event:"provider.unknown",data:{}})).status,200,"unrelated events acknowledged without writes");
 assert.equal((await call({event:"deposit.success"})).status,400,"deposit with no data rejected");
 delete process.env.BLOCKRADAR_SOLANA_USDC_MINT;
 assert.equal((await call({event:"deposit.success",data:{}})).status,503,"missing mint fails closed");
 process.env.BLOCKRADAR_SOLANA_USDC_MINT="ci-verified-mint";
 assert.equal((await call({event:"deposit.swept.failed",data:{id:"ci-sweep-failed"}})).status,200,
  "failed sweep must be acknowledged without optimistic credit");
 assert.equal((await call({event:"deposit.success",data:{status:"PENDING",type:"DEPOSIT",id:"unconfirmed"}})).status,200,
  "unconfirmed custody cannot credit funds");
 assert.equal((await call({event:"deposit.swept.success",data:{
  id:"ci-unknown-wallet",status:"SUCCESS",type:"DEPOSIT",confirmed:true,
  recipientAddress:"ci-not-a-registered-wallet",hash:"ci-chain-hash",amount:"1.000000",network:"testnet",
  wallet:{id:"ci-verified-master"},asset:{address:"ci-verified-mint",symbol:"USDC",decimals:6}
 }})).status,422,"verified but unknown deposit address rejected");
 assert.equal((await call({event:"withdraw.success"})).status,400,"missing withdrawal data rejected");
 const unrelated=await call({event:"withdraw.success",data:{reference:"withdrawal:invalid"}});
 assert.equal(unrelated.status,200);
 assert.equal(unrelated.headers.get("cache-control"),"no-store");
 // Real PostgreSQL settlement: only proven full custody sweep can credit once.
 const {PrismaClient}=await import("@prisma/client");
 const db=new PrismaClient();
 const userId="ci_verified_deposit_user";
 const providerTx="ci-verified-deposit-tx";
 const address="ci-verified-deposit-address";
 const masterWalletId="CI_TEST_WALLET";
 const masterAddress="CI_TEST_ADDRESS";
 const micros=1500001n;
 const treasuryBefore=await db.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
 try{
  await db.user.create({data:{id:userId,email:"ci-verified-deposit@example.invalid",name:"Verified CI",passwordHash:"ci-fixture"}});
  await db.investorDepositWallet.create({data:{
   userId,status:"ACTIVE",masterWalletId,address,addressId:"ci-verified-address-id"
  }});
  process.env.BLOCK_RADAR_MASTER_WALLET_ID=masterWalletId;
  const data={
   id:providerTx,status:"SUCCESS",type:"DEPOSIT",confirmed:true,
   recipientAddress:address,hash:"ci-verified-chain-hash",amount:"1.500001",network:"testnet",
   wallet:{id:masterWalletId,address:masterAddress},
   asset:{address:"ci-verified-mint",symbol:"USDC",decimals:6},
   address:{id:"ci-verified-address-id",address}
  };
  const amountBefore=(await db.user.findUniqueOrThrow({where:{id:userId}})).unallocated;
  assert.equal((await call({event:"deposit.success",data})).status,200);
  assert.equal((await db.blockchainDeposit.findUniqueOrThrow({where:{providerTransactionId:providerTx}})).status,"CONFIRMING");
  assert.equal((await db.user.findUniqueOrThrow({where:{id:userId}})).unallocated,amountBefore,
   "deposit notification alone must not credit unproven custody");
  const swept={...data,assetSwept:true,assetSweptAmount:"1.500001",
   assetSweptHash:"ci-sweep-hash",assetSweptSenderAddress:address,
   assetSweptRecipientAddress:masterAddress};
  assert.equal((await call({event:"deposit.swept.success",data:{...swept,assetSweptAmount:"1.500000"}})).status,422,
   "partial sweep must not settle");
  assert.equal((await db.user.findUniqueOrThrow({where:{id:userId}})).unallocated,amountBefore);
  assert.equal((await call({event:"deposit.swept.success",data:swept})).status,200);
  assert.equal((await call({event:"deposit.swept.success",data:swept})).status,200,
   "duplicate signed sweep is acknowledged without second settlement");
  assert.equal((await db.user.findUniqueOrThrow({where:{id:userId}})).unallocated,amountBefore+micros,
   "verified full sweep credits exactly once");
  // Competing first-time signed sweep deliveries must never mint duplicate equity.
  const racingId="ci-verified-deposit-racing";
  const racingData={...data,id:racingId,hash:"ci-racing-hash"};
  const racingSweep={...swept,id:racingId,hash:"ci-racing-hash",assetSweptHash:"ci-racing-sweep-hash"};
  assert.equal((await call({event:"deposit.success",data:racingData})).status,200);
  const concurrent=await Promise.all(Array.from({length:4},()=>
   call({event:"deposit.swept.success",data:racingSweep})));
  assert.ok(concurrent.every(r=>[200,503].includes(r.status)),
   "serialization losers must be retried, not acknowledged as settled");
  assert.ok(concurrent.some(r=>r.status===200),"at least one confirmed sweep must succeed");
  assert.equal((await call({event:"deposit.swept.success",data:racingSweep})).status,200,
   "retrying a raced sweep remains safe");
  assert.equal(await db.treasuryTransfer.count({where:{reference:racingId}}),1);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:userId}})).unallocated,amountBefore+micros*2n,
   "racing sweeps must credit one additional deposit, never more");
  const deposit=await db.blockchainDeposit.findUniqueOrThrow({where:{providerTransactionId:providerTx}});
  assert.equal(deposit.status,"CONFIRMED");
  assert.ok(deposit.treasuryTransactionId);
  assert.equal(await db.treasuryTransfer.count({where:{reference:providerTx}}),1);
  assert.equal((await db.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}})).amount,treasuryBefore.amount+micros*2n);
 }finally{
  await db.investorActivity.deleteMany({where:{userId}});
  await db.blockchainDeposit.deleteMany({where:{providerTransactionId:{in:[providerTx,"ci-verified-deposit-racing"]}}});
  await db.treasuryTransfer.deleteMany({where:{reference:{in:[providerTx,"ci-verified-deposit-racing"]}}});
  await db.investorDepositWallet.deleteMany({where:{userId}});
  await db.user.deleteMany({where:{id:userId}});
  await db.treasury.update({where:{kind:"DEPOSIT"},data:{amount:treasuryBefore.amount}});
  await db.$disconnect();
 }
 console.log("Verified Blockradar queue processing: signature, configuration and custody safety checks passed");
}finally{
 for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}
}
