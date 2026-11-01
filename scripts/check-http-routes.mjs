import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {setTimeout as sleep} from "node:timers/promises";
import {PrismaClient} from "@prisma/client";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL?.includes("zenvest_ci")) throw new Error("Refusing non-CI database");
const port=33891;
const base="http://127.0.0.1:"+port;
const child=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p",String(port)],{
 env:{...process.env,NODE_ENV:"production",NEXTAUTH_URL:base,NEXTAUTH_SECRET:"local-ci-only-secret-value"},stdio:["ignore","pipe","pipe"]
});
let startupLog="";
for(const stream of [child.stdout,child.stderr])stream.on("data",chunk=>{
 startupLog=(startupLog+String(chunk)).slice(-8000);
});
async function call(path,init){return fetch(base+path,{redirect:"manual",...init});}
try{
 let started=false;
 for(let i=0;i<90;i++){
  if(child.exitCode!==null)throw new Error("Next server exited before test");
  try{const res=await call("/api/internal/process-position-trade-pnl");if(res.status===401){started=true;break;}}catch{}
  await sleep(500);
 }
 assert.equal(started,true,"Built application starts; diagnostic output: "+startupLog);
 for(const endpoint of ["earn/allocations","earn/deallocations","earn/positions/close","withdrawals"]){
  const res=await call("/api/"+endpoint,{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
  assert.ok([302,303,307,308,401].includes(res.status),
   endpoint+" should reject anonymous mutation; status "+res.status);
 }
 for(const endpoint of ["process-position-trade-pnl","process-position-allocations",
   "process-position-deallocations","process-withdrawals"]){
  const res=await call("/api/internal/"+endpoint);
  assert.equal(res.status,401,endpoint+" should reject missing cron authorization");
 }
 const webhook=await call("/api/webhooks/blockradar",{method:"POST",
  headers:{"content-type":"application/json","x-blockradar-signature":"not-valid"},
  body:'{"event":"deposit.success","data":{"id":"ci-http-fixture"}}'});
 assert.ok([401,503].includes(webhook.status),
  "Unsigned provider message must never be accepted or queued");
 // Exercise NextAuth's real credentials exchange, not the CI route-auth shim.
 const prisma=new PrismaClient();
 const userId="ci_http_authenticated_user";
 const strategyId="ci_http_authenticated_strategy";
 try{
  const password="ci-test-password-only";
  await prisma.user.create({data:{
   id:userId,email:"ci-http-authenticated@example.invalid",name:"CI HTTP Investor",
   passwordHash:await bcrypt.hash(password,10),emailVerifiedAt:new Date(),unallocated:10000000n
  }});
  await prisma.strategy.create({data:{
   id:strategyId,name:"CI HTTP Authenticated Strategy",description:"Ephemeral authenticated HTTP fixture",
   isActive:true,isPublic:true,kalshiWalletAddress:"11111111111111111111111111111111",
   minAllocationUsdcMicros:1000000n,maxAllocationUsdcMicros:10000000n,
   availableCapacityUsdcMicros:10000000n
  }});
  const csrf=await call("/api/auth/csrf");
  assert.equal(csrf.status,200,"NextAuth CSRF endpoint must respond");
  const csrfToken=(await csrf.json()).csrfToken;
  const csrfCookie=csrf.headers.getSetCookie().map(x=>x.split(";")[0]).find(x=>x.includes("csrf-token"));
  assert.ok(csrfToken&&csrfCookie,"real CSRF handshake must issue token and cookie");
  const login=await call("/api/auth/callback/credentials",{
   method:"POST",
   headers:{"content-type":"application/x-www-form-urlencoded",cookie:csrfCookie},
   body:new URLSearchParams({csrfToken,email:"ci-http-authenticated@example.invalid",password,
    callbackUrl:base+"/dashboard",json:"true"}).toString()
  });
  const sessionCookie=login.headers.getSetCookie().map(x=>x.split(";")[0]).find(x=>x.includes("session-token"));
  assert.ok(sessionCookie,"successful credentials login must set a real NextAuth session: HTTP "+login.status);
  const cookie=csrfCookie+"; "+sessionCookie;
  const invalid=await call("/api/earn/allocations",{
   method:"POST",headers:{"content-type":"application/json",cookie},
   body:JSON.stringify({strategyId,amount:"-1"})
  });
  assert.equal(invalid.status,400,"authenticated invalid allocation must return 400");
  const created=await call("/api/earn/allocations",{
   method:"POST",headers:{"content-type":"application/json",cookie},
   body:JSON.stringify({strategyId,amount:"3.000001"})
  });
  assert.equal(created.status,201,"real authenticated allocation must persist successfully: HTTP "+created.status);
  const data=await created.json();
  const saved=await prisma.positionAllocation.findUniqueOrThrow({where:{id:data.operationId}});
  assert.equal(saved.userId,userId);
  assert.equal(saved.amountUsdcMicros,3000001n);
  assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated,10000000n);
  console.log("Authenticated HTTP verified: real NextAuth credentials login, invalid and successful investor allocation, and PostgreSQL ownership");
 }finally{
  await prisma.positionAllocation.deleteMany({where:{userId}});
  await prisma.investorPosition.deleteMany({where:{userId}});
  await prisma.strategy.deleteMany({where:{id:strategyId}});
  await prisma.user.deleteMany({where:{id:userId}});
  await prisma.$disconnect();
 }
 console.log("HTTP smoke verified: anonymous financial operations rejected, cron protected, unsigned provider payload refused");
}finally{
 child.kill("SIGTERM");
 await sleep(400);
 if(child.exitCode===null)child.kill("SIGKILL");
}
