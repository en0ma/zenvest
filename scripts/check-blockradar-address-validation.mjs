import assert from "node:assert/strict";
import {registerHooks} from "node:module";
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="server-only")return nextResolve(new URL("./ci-server-only-shim.mjs",import.meta.url).href,context);
 if(specifier.startsWith("./")&&context.parentURL?.includes("/src/lib/")&&!/\.[cm]?[jt]s$/.test(specifier))
  return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
const {validateBlockradarSolanaAddress}=await import("../src/lib/blockradar-address-validation.ts");
const address="So11111111111111111111111111111111111111112";
const oldKey=process.env.BLOCK_RADAR_API_KEY,oldFetch=globalThis.fetch;
try{
 process.env.BLOCK_RADAR_API_KEY="ci-fixture";
 let count=0;
 globalThis.fetch=async(input,options)=>{
  count++;
  const url=new URL(String(input));
  assert.equal(url.pathname,"/v1/addresses/validate");
  assert.equal(url.searchParams.get("blockchain"),"solana");
  assert.equal(url.searchParams.get("address"),address);
  assert.equal(options.method,"GET");
  return new Response(JSON.stringify({data:{isValid:true,address,blockchain:"solana"}}));
 };
 assert.equal(await validateBlockradarSolanaAddress(address),true);
 assert.equal(await validateBlockradarSolanaAddress("invalid"),false);
 assert.equal(count,1);
 globalThis.fetch=async()=>new Response(JSON.stringify({data:{isValid:false,address,blockchain:"solana"}}));
 assert.equal(await validateBlockradarSolanaAddress(address),false);
 globalThis.fetch=async()=>new Response(JSON.stringify({data:{isValid:true,address,blockchain:"ethereum"}}));
 await assert.rejects(validateBlockradarSolanaAddress(address),/Mismatched/);
 globalThis.fetch=async()=>new Response("{}",{status:200});
 await assert.rejects(validateBlockradarSolanaAddress(address),/Malformed/);
 globalThis.fetch=async()=>new Response("Unavailable",{status:503});
 await assert.rejects(validateBlockradarSolanaAddress(address),/unavailable/);
 console.log("Blockradar address validation contract passed");
}finally{
 globalThis.fetch=oldFetch;
 if(oldKey===undefined)delete process.env.BLOCK_RADAR_API_KEY;
 else process.env.BLOCK_RADAR_API_KEY=oldKey;
}
