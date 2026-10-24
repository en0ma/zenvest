import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
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
const {PrismaClient}=await import("@prisma/client");
const prisma=new PrismaClient();
const previous={key:process.env.BLOCK_RADAR_API_KEY,wallet:process.env.BLOCK_RADAR_MASTER_WALLET_ID};
const secret="ci-webhook-concurrency-key";
const wallet="ci-webhook-concurrency-wallet";
const {POST}=await import("../src/app/api/webhooks/blockradar/route.ts");
const unique="ci-webhook-race-"+process.pid;
const event="deposit.swept.success";
const id=unique+"-transaction";
const body=JSON.stringify({event,data:{id}});
const sign=raw=>createHmac("sha512",secret).update(raw).digest("hex");
const submit=(raw,signature=sign(raw))=>POST(new Request("https://ci.invalid/api/webhooks/blockradar",{
 method:"POST",body:raw,headers:{"x-blockradar-signature":signature}
}));
try{
 process.env.BLOCK_RADAR_API_KEY=secret;
 process.env.BLOCK_RADAR_MASTER_WALLET_ID=wallet;
 assert.equal((await submit(body,"bad")).status,401,"invalid HMAC must not enqueue");
 assert.equal((await submit("{broken")).status,400,"invalid JSON must not enqueue");
 assert.equal((await submit(JSON.stringify({event,data:{}}))).status,400,"missing identity must not enqueue");
 const results=await Promise.all(Array.from({length:12},()=>submit(body)));
 assert.ok(results.every(r=>r.status===200),"concurrent signed duplicates must be accepted without duplicate insert");
 const {createHash}=await import("node:crypto");
 const hash=createHash("sha256").update(event+"\0"+id).digest("hex");
 const entries=await prisma.webhookQueue.findMany({where:{source:"BLOCKRADAR",idempotencyKey:hash}});
 assert.equal(entries.length,1,"concurrent signed delivery must create exactly one durable queue record");
 assert.equal(entries[0].status,"PENDING");
 const conflicting=JSON.stringify({event,data:{id,other:"altered"}});
 assert.equal((await submit(conflicting)).status,409,"same identity with altered signed body must conflict");
 const lifecycle=JSON.stringify({event:"deposit.success",data:{id}});
 assert.equal((await submit(lifecycle)).status,200,"distinct lifecycle events must not deduplicate");
 assert.equal(await prisma.webhookQueue.count({where:{source:"BLOCKRADAR",idempotencyKey:{
  in:[hash,createHash("sha256").update("deposit.success"+"\0"+id).digest("hex")]
 }}}),2);
 console.log("Signed webhook concurrent duplicate ingestion and durable idempotency passed");
}finally{
 const {createHash}=await import("node:crypto");
 const hashes=[event,"deposit.success"].map(e=>createHash("sha256").update(e+"\0"+id).digest("hex"));
 await prisma.webhookQueue.deleteMany({where:{source:"BLOCKRADAR",idempotencyKey:{in:hashes}}});
 await prisma.$disconnect();
 if(previous.key===undefined)delete process.env.BLOCK_RADAR_API_KEY;else process.env.BLOCK_RADAR_API_KEY=previous.key;
 if(previous.wallet===undefined)delete process.env.BLOCK_RADAR_MASTER_WALLET_ID;else process.env.BLOCK_RADAR_MASTER_WALLET_ID=previous.wallet;
}
