import assert from "node:assert/strict";
import {registerHooks} from "node:module";
const shim=new URL("./ci-route-runtime-shim.mjs",import.meta.url).href;
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="next/server"||specifier==="@/lib/access")return nextResolve(shim,context);
 if(specifier==="server-only")return nextResolve(new URL("./ci-server-only-shim.mjs",import.meta.url).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",import.meta.url).href,context);
 if(specifier.startsWith("./")&&context.parentURL?.includes("/src/lib/")&&!/\.[cm]?[jt]s$/.test(specifier))return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("Disposable CI database required");
const {PrismaClient}=await import("@prisma/client");
const db=new PrismaClient();
const {POST}=await import("../src/app/api/wallet/activate/route.ts");
const userId="ci_route_investor";
const names=["BLOCKRADAR_DEPOSITS_ENABLED","BLOCK_RADAR_API_KEY","BLOCK_RADAR_MASTER_WALLET_ID"];
const saved=Object.fromEntries(names.map(k=>[k,process.env[k]]));
const originalFetch=globalThis.fetch;
const address="11111111111111111111111111111111";
try{
 await db.user.create({data:{id:userId,email:"ci-wallet-activation@example.invalid",name:"CI Wallet",passwordHash:"fixture"}});
 delete process.env.BLOCKRADAR_DEPOSITS_ENABLED;
 assert.equal((await POST()).status,503);
 process.env.BLOCKRADAR_DEPOSITS_ENABLED="true";
 delete process.env.BLOCK_RADAR_API_KEY;
 assert.equal((await POST()).status,503);
 process.env.BLOCK_RADAR_API_KEY="ci-key";
 process.env.BLOCK_RADAR_MASTER_WALLET_ID="ci-master";
 let requests=0;
 globalThis.fetch=async()=>{requests++;return Response.json({data:{id:"ci-address-id",address,blockchain:{slug:"solana"},isActive:true}});};
 const attempts=await Promise.all([POST(),POST()]);
 assert.ok(attempts.some(r=>r.status===200),"one activation should succeed");
 assert.ok(attempts.every(r=>[200,409].includes(r.status)),"racing requests cannot create two wallets");
 assert.equal(requests,1,"single provider address creation under concurrent requests");
 const wallet=await db.investorDepositWallet.findUniqueOrThrow({where:{userId}});
 assert.equal(wallet.status,"ACTIVE");
 assert.equal(wallet.address,address);
 assert.equal((await POST()).status,200,"already active wallet can be reused");
 assert.equal(requests,1);
 await db.investorDepositWallet.delete({where:{userId}});
 globalThis.fetch=async()=>{requests++;throw Error("provider unavailable");};
 assert.equal((await POST()).status,502,"ambiguous provider failure returns controlled response");
 assert.equal((await db.investorDepositWallet.findUniqueOrThrow({where:{userId}})).status,"ERROR");
 assert.equal((await POST()).status,409,"error wallet cannot automatically recreate provider address");
 console.log("Wallet activation PostgreSQL concurrency, successful claim and failed provider safeguards passed");
}finally{
 globalThis.fetch=originalFetch;
 await db.investorDepositWallet.deleteMany({where:{userId}});
 await db.user.deleteMany({where:{id:userId}});
 await db.$disconnect();
 for(const name of names){if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name];}
}
