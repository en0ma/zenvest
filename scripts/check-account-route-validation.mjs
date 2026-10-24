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
