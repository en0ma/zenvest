import assert from "node:assert/strict";
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
const routes=[
 "../src/app/api/account/activate/route.ts",
 "../src/app/api/account/confirm/route.ts",
 "../src/app/api/account/request-link/route.ts"
];
for(const path of routes){
 const {POST}=await import(path);
 for(const payload of ["{bad","{}",'{"extra":"unknown"}']){
  const result=await POST(new Request("https://ci.invalid/account",{method:"POST",body:payload}));
  assert.equal(result.status,400,path+" rejects malformed account request");
 }
}
console.log("Account route validation coverage passed");

const {PrismaClient}=await import("@prisma/client");
const {digest}=await import("../src/lib/account-tokens.ts");
const prisma=new PrismaClient();
const userId="ci_account_validation";
const token="a".repeat(64);
const confirm=(await import("../src/app/api/account/confirm/route.ts")).POST;
const request=(payload)=>new Request("https://ci.invalid/api/account/confirm",{method:"POST",body:JSON.stringify(payload)});
try{
 await prisma.user.create({data:{id:userId,email:"ci-account-validation@example.invalid",name:"Account Validation",passwordHash:"fixture"}});
 assert.equal((await confirm(request({token,purpose:"RESET_PASSWORD"}))).status,400);
 assert.equal((await confirm(request({token:"invalid",purpose:"VERIFY_EMAIL"}))).status,400);
 assert.equal((await confirm(request({token,purpose:"VERIFY_EMAIL",password:"TestPassword123!"}))).status,400);
 assert.equal((await confirm(request({token,purpose:"VERIFY_EMAIL"}))).status,400);
 await prisma.actionToken.create({data:{userId,purpose:"VERIFY_EMAIL",hash:digest(token),expiresAt:new Date(Date.now()+600000)}});
 assert.equal((await confirm(request({token,purpose:"RESET_PASSWORD",password:"TestPassword123!"}))).status,400);
 const first=await confirm(request({token,purpose:"VERIFY_EMAIL"}));
 assert.equal(first.status,200);
 assert.equal((await first.json()).ok,true);
 assert.ok((await prisma.user.findUniqueOrThrow({where:{id:userId}})).emailVerifiedAt);
 assert.equal((await confirm(request({token,purpose:"VERIFY_EMAIL"}))).status,400);
 const {POST:requestLink}=await import("../src/app/api/account/request-link/route.ts");
 const callLink=(payload)=>requestLink(new Request("https://ci.invalid/api/account/request-link",{method:"POST",body:JSON.stringify(payload)}));
 const unknown=await callLink({email:"absent-ci-account@example.invalid",purpose:"RESET_PASSWORD"});
 assert.equal(unknown.status,200);
 const active=await callLink({email:"ci-account-validation@example.invalid",purpose:"VERIFY_EMAIL"});
 assert.equal(active.status,200);
 assert.deepEqual(await active.json(),await unknown.json(),"account existence must not leak");
 assert.equal(await prisma.actionToken.count({where:{userId}}),1,"verified investor must not receive another verification token");
 const inactiveToken="e".repeat(64);
 await prisma.actionToken.create({data:{userId,purpose:"VERIFY_EMAIL",hash:digest(inactiveToken),expiresAt:new Date(Date.now()+600000)}});
 await prisma.user.update({where:{id:userId},data:{isActive:false}});
 assert.equal((await confirm(request({token:inactiveToken,purpose:"VERIFY_EMAIL"}))).status,400,
  "inactive user cannot confirm even with a valid token");
 await prisma.user.update({where:{id:userId},data:{isActive:true}});
 const expired="d".repeat(64);
 await prisma.actionToken.create({data:{userId,purpose:"VERIFY_EMAIL",hash:digest(expired),expiresAt:new Date(Date.now()-60000)}});
 assert.equal((await confirm(request({token:expired,purpose:"VERIFY_EMAIL"}))).status,400,
  "expired verification token must never activate account");
 const expiredReset="f".repeat(64);
 await prisma.actionToken.create({data:{userId,purpose:"RESET_PASSWORD",hash:digest(expiredReset),expiresAt:new Date(Date.now()-60000)}});
 const versionBeforeExpiry=(await prisma.user.findUniqueOrThrow({where:{id:userId}})).sessionVersion;
 assert.equal((await confirm(request({token:expiredReset,purpose:"RESET_PASSWORD",password:"NewPass123!"}))).status,400);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).sessionVersion,versionBeforeExpiry);
 const reset="c".repeat(64);
 const sessionBefore=(await prisma.user.findUniqueOrThrow({where:{id:userId}})).sessionVersion;
 await prisma.actionToken.create({data:{userId,purpose:"RESET_PASSWORD",hash:digest(reset),expiresAt:new Date(Date.now()+600000)}});
 const resetResponse=await confirm(request({token:reset,purpose:"RESET_PASSWORD",password:"NewPass123!"}));
 assert.equal(resetResponse.status,200);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).sessionVersion,sessionBefore+1);
 assert.equal((await confirm(request({token:reset,purpose:"RESET_PASSWORD",password:"NewPass123!"}))).status,400);
 console.log("Account token lifecycle passed: purpose isolation, single use and verified state");
}finally{
 await prisma.actionToken.deleteMany({where:{userId}});
 await prisma.user.deleteMany({where:{id:userId}});
 await prisma.$disconnect();
}
