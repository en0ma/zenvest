import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {setTimeout as sleep} from "node:timers/promises";

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
 console.log("HTTP smoke verified: anonymous financial operations rejected, cron protected, unsigned provider payload refused");
}finally{
 child.kill("SIGTERM");
 await sleep(400);
 if(child.exitCode===null)child.kill("SIGKILL");
}
