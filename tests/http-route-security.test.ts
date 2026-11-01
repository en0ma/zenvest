import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

// Contract tests protect the HTTP security boundary without requiring a live
// Next.js server or provider credentials. A separate end-to-end server suite
// remains necessary to verify actual session and request behavior.
const source=(path:string)=>readFileSync(resolve(process.cwd(),"src/app/api",path,"route.ts"),"utf8");

test("every investor money mutation enforces authenticated session before creating operations",()=>{
 for(const path of ["earn/allocations","earn/deallocations","earn/positions/close","withdrawals"]){
  const code=source(path);
  assert.match(code,/requireUser\(\)/,path+" must resolve an authenticated user");
  assert.match(code,/userId:\s*user\.id|userId:\s*user\.id\b/,path+" must bind queries to logged-in user");
 }
});
test("financial mutation endpoints validate request input before database transaction",()=>{
 for(const path of ["earn/allocations","earn/deallocations","earn/positions/close","withdrawals"]){
  const code=source(path);
  assert.match(code,/request\.json\(\)/);
  assert.match(code,/status:400/);
 }
});
test("internal money processing routes require a cron secret",()=>{
 for(const path of ["internal/process-position-trade-pnl","internal/process-position-allocations",
  "internal/process-position-deallocations","internal/process-withdrawals"]){
  const code=source(path);
  assert.match(code,/authorizedCron\(request\)/,path);
  assert.match(code,/status:401/,path);
 }
});
test("webhook intake authenticates signature before durable enqueue",()=>{
 const code=source("webhooks/blockradar");
 const signatureCheck=code.indexOf("validBlockradarSignature(raw,signature,key)");
 const firstWrite=code.indexOf("prisma.webhookQueue.create(");
 assert.ok(signatureCheck>=0&&firstWrite>signatureCheck);
 assert.match(code,/status:401/);
 assert.match(code,/Conflicting event identity/);
});
