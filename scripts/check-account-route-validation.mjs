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
const {POST:register}=await import("../src/app/api/register/route.ts");
const registerRequest=body=>new Request("https://ci.invalid/api/register",{method:"POST",body});
assert.equal((await register(registerRequest("{bad"))).status,400,"malformed registration JSON rejected");
assert.equal((await register(registerRequest(JSON.stringify({
 name:"CI",email:"bad-email",password:"TestPass123!"
})))).status,400,"invalid registration fields rejected");
assert.equal((await register(registerRequest(JSON.stringify({
 name:"Account Validation",email:"ci-account-validation@example.invalid",
 password:"TestPass123!",role:"ADMIN"
})))).status,400,"role injection rejected");
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
 const existingRegistration=await register(registerRequest(JSON.stringify({
  name:"CiAccount",email:"ci-account-validation@example.invalid",password:"TestPass123!"
 })));
 assert.equal(existingRegistration.status,409,"verified account registration cannot overwrite an existing identity");

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
 // Multiple successful-looking activation attempts against the same token
 // must produce exactly one durable activation and consume the token once.
 await prisma.user.update({where:{id:userId},data:{emailVerifiedAt:null}});
 const racingToken="2".repeat(64);
 await prisma.actionToken.create({data:{userId,purpose:"VERIFY_EMAIL",hash:digest(racingToken),expiresAt:new Date(Date.now()+600000)}});
 const {activateEmailFromLink}=await import("../src/lib/account-tokens.ts");
 const raced=await Promise.allSettled(Array.from({length:4},()=>activateEmailFromLink(racingToken)));
 assert.ok(raced.some(result=>result.status==="fulfilled"&&result.value?.status==="activated"),
  "one activation transaction must succeed");
 assert.ok(raced.every(result=>result.status==="fulfilled"||
  result.reason?.code==="P2034"),"only retryable serialization conflicts are acceptable");
 assert.ok((await prisma.user.findUniqueOrThrow({where:{id:userId}})).emailVerifiedAt);
 assert.ok((await prisma.actionToken.findUniqueOrThrow({where:{hash:digest(racingToken)}})).consumedAt);
 const replay=await activateEmailFromLink(racingToken);
 assert.equal(replay?.status,"already_active","already verified account receives explicit state");
 // Password reset tokens must be purpose-bound and never usable for email activation.
 const {consumeToken}=await import("../src/lib/account-tokens.ts");
 const crossPurpose="3".repeat(64);
 await prisma.actionToken.create({data:{userId,purpose:"RESET_PASSWORD",hash:digest(crossPurpose),expiresAt:new Date(Date.now()+600000)}});
 assert.equal(await activateEmailFromLink(crossPurpose),null,
  "reset token must never activate an email account");
 assert.equal((await prisma.actionToken.findUniqueOrThrow({where:{hash:digest(crossPurpose)}})).consumedAt,null,
  "wrong-purpose verification must not consume the reset token");
 assert.equal(await consumeToken(crossPurpose,"VERIFY_EMAIL"),false,
  "reset token must not be valid as a verification token");
 // Resetting a password must invalidate all other outstanding reset links,
 // including ones that may have been issued before the accepted request.
 const staleLink="4".repeat(64);
 await prisma.actionToken.create({data:{userId,purpose:"RESET_PASSWORD",hash:digest(staleLink),expiresAt:new Date(Date.now()+600000)}});
 const fresh="1".repeat(64);
 await prisma.actionToken.create({data:{userId,purpose:"RESET_PASSWORD",hash:digest(fresh),expiresAt:new Date(Date.now()+600000)}});
 const throttled=await callLink({email:"ci-account-validation@example.invalid",purpose:"RESET_PASSWORD"});
 assert.equal(throttled.status,200);
 assert.equal(await prisma.actionToken.count({where:{userId,purpose:"RESET_PASSWORD"}}),4,
  "recent password reset cannot issue another token");
 await prisma.actionToken.delete({where:{hash:digest(fresh)}});
 const reset="c".repeat(64);
 const sessionBefore=(await prisma.user.findUniqueOrThrow({where:{id:userId}})).sessionVersion;
 await prisma.actionToken.create({data:{userId,purpose:"RESET_PASSWORD",hash:digest(reset),expiresAt:new Date(Date.now()+600000)}});
 const resetRace=await Promise.allSettled(Array.from({length:4},()=>
  consumeToken(reset,"RESET_PASSWORD","ci-raced-hashed-password")));
 assert.equal(resetRace.filter(result=>result.status==="fulfilled"&&result.value===true).length,1,
  "concurrent password reset requests must consume token exactly once");
 assert.ok(resetRace.every(result=>result.status==="fulfilled"||result.reason?.code==="P2034"),
  "only retryable serialization conflicts may interrupt competing reset transactions");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).sessionVersion,sessionBefore+1);
 assert.equal((await confirm(request({token:reset,purpose:"RESET_PASSWORD",password:"NewPass123!"}))).status,400);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).passwordHash,"ci-raced-hashed-password");
 assert.equal(await prisma.actionToken.count({where:{userId,purpose:"RESET_PASSWORD"}}),0,
  "successful password reset must revoke all other outstanding reset tokens");
 assert.equal(await consumeToken(staleLink,"RESET_PASSWORD","ci-untrusted-password"),false,
  "an older reset link cannot change credentials after a successful reset");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).passwordHash,"ci-raced-hashed-password");
 console.log("Account token lifecycle passed: purpose isolation, single use and verified state");
}finally{
 await prisma.actionToken.deleteMany({where:{userId}});
 await prisma.user.deleteMany({where:{id:userId}});
 await prisma.$disconnect();
}
