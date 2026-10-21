import test from "node:test";
import assert from "node:assert/strict";
import {executeBlockradarCron} from "../src/lib/blockradar-cron-execution.ts";
import type {BlockradarCronAction} from "../src/lib/blockradar-wallet-actions.ts";

const previous=process.env.CRON_SECRET;
const make=(secret?:string)=>new Request("https://zenvest.test/internal",{headers:secret?{authorization:`Bearer ${secret}`}:{}});
test("both cron jobs reject absent, invalid and malformed credentials without invoking provider",async()=>{
 process.env.CRON_SECRET="test-cron-secret";
 try{
  for(const action of ["rescan","sweep"] as const){
   let calls=0;
   const send=async()=>{calls++;};
   for(const req of [make(),make("wrong"),new Request("https://zenvest.test/internal",{headers:{authorization:"test-cron-secret"}})]){
    assert.deepEqual(await executeBlockradarCron(req,action,()=>({key:"key",walletId:"id"}),send),{status:401,body:{error:"Unauthorized"}});
   }
   assert.equal(calls,0);
  }
 }finally{if(previous===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=previous;}
});
test("both scheduled actions execute with auth regardless of deposit feature flags",async()=>{
 process.env.CRON_SECRET="test-cron-secret";
 const prior=process.env.BLOCKRADAR_DEPOSITS_ENABLED;
 delete process.env.BLOCKRADAR_DEPOSITS_ENABLED;
 try{
  for(const action of ["rescan","sweep"] as const){
   const invocations:BlockradarCronAction[]=[];
   const result=await executeBlockradarCron(make("test-cron-secret"),action,()=>({key:"mock",walletId:"solana-id"}),async(a,config)=>{
    assert.deepEqual(config,{key:"mock",walletId:"solana-id"});
    invocations.push(a);
   });
   assert.deepEqual(result,{status:200,body:{status:"requested",action}});
   assert.deepEqual(invocations,[action]);
  }
 }finally{if(previous===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=previous;
  if(prior===undefined)delete process.env.BLOCKRADAR_DEPOSITS_ENABLED;else process.env.BLOCKRADAR_DEPOSITS_ENABLED=prior;}
});
test("provider errors and missing wallet configuration return 503 instead of successful scheduling",async()=>{
 process.env.CRON_SECRET="test-cron-secret";
 try{
  for(const action of ["rescan","sweep"] as const){
   const broken=await executeBlockradarCron(make("test-cron-secret"),action,()=>({key:"mock",walletId:"id"}),async()=>{throw new Error("provider down");});
   assert.equal(broken.status,503);
   const unconfigured=await executeBlockradarCron(make("test-cron-secret"),action,()=>{throw new Error("missing wallet");},async()=>{throw new Error("must not run");});
   assert.equal(unconfigured.status,503);
  }
 }finally{if(previous===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=previous;}
});
