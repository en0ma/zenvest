import assert from "node:assert/strict";
import {registerHooks} from "node:module";
const here=new URL(".",import.meta.url);
registerHooks({resolve(specifier,context,nextResolve){
 if(["@/lib/db","@/lib/staff-access","@/lib/blockradar"].includes(specifier))return nextResolve(new URL("ci-staff-reconcile-shim.mjs",here).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",here).href,context);
 return nextResolve(specifier,context);
}});
const {state}=await import("./ci-staff-reconcile-shim.mjs");
const {POST}=await import("../src/app/api/admin/actions/[id]/reconcile/route.ts");
const env={...process.env};
const originalFetch=globalThis.fetch;
const call=()=>POST(new Request("https://ci.invalid/api/admin/actions/ci-action/reconcile",{method:"POST"}),{params:Promise.resolve({id:"ci-action"})});
try{
 process.env.STAFF_DEPOSIT_RECONCILIATION_ENABLED="false";process.env.BLOCKRADAR_DEPOSITS_ENABLED="true";
 assert.equal((await call()).status,503);
 process.env.STAFF_DEPOSIT_RECONCILIATION_ENABLED="true";
 state.deny=true;assert.equal((await call()).status,403);state.deny=false;
 state.decidedBy="maker";assert.equal((await call()).status,409);state.decidedBy="checker";
 state.creditedAt=new Date();assert.equal((await call()).status,409);state.creditedAt=null;
 state.masterWalletId="wrong-master";assert.equal((await call()).status,409);state.masterWalletId="ci-master";
 globalThis.fetch=async(url,init)=>{state.requests++;assert.equal(String(url),"https://api.blockradar.co/v1/wallets/ci-master/transactions/ci-transaction/resend-webhook");assert.equal(init.method,"POST");assert.equal(init.headers["x-api-key"],"ci-api-key");return new Response(null,{status:state.providerStatus})};
 const response=await call();
 assert.equal(response.status,200);assert.equal((await response.json()).execution,"AWAITING_SIGNED_BLOCKRADAR_WEBHOOK");
 assert.equal(state.claims,1);assert.equal(state.requests,1);assert.equal(state.audit.length,1);
 assert.equal((await call()).status,409,"consumed approval cannot replay twice");
 assert.equal(state.requests,1);
 state.actionStatus="APPROVED";state.providerStatus=503;
 assert.equal((await call()).status,503,"provider failure is unknown, never a retry approval");
 assert.equal(state.actionStatus,"EXECUTED");assert.equal(state.requests,2);
 console.log("Target-specific signed Blockradar deposit replay, authorization, single-consumption and no-retry API tests passed");
}finally{
 globalThis.fetch=originalFetch;
 for(const name of ["STAFF_DEPOSIT_RECONCILIATION_ENABLED","BLOCKRADAR_DEPOSITS_ENABLED"]){if(env[name]===undefined)delete process.env[name];else process.env[name]=env[name]}
}
