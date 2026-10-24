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
const previous=process.env.CRON_SECRET;
try{
 process.env.CRON_SECRET="ci-cron-route-secret";
 const paths=[
  "../src/app/api/internal/process-webhook-queue/route.ts",
  "../src/app/api/internal/process-withdrawals/route.ts",
  "../src/app/api/internal/process-position-allocations/route.ts",
  "../src/app/api/internal/process-position-trade-pnl/route.ts",
 ];
 for(const path of paths){
  const {GET}=await import(path);
  const missing=await GET(new Request("https://ci.invalid/internal"));
  assert.equal(missing.status,401,path+" must reject absent cron authorization");
  const invalid=await GET(new Request("https://ci.invalid/internal",{headers:{authorization:"Bearer wrong"}}));
  assert.equal(invalid.status,401,path+" must reject incorrect cron authorization");
 }
 console.log("Financial worker cron route authentication passed");
}finally{
 if(previous===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=previous;
}
