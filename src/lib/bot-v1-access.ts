import {prisma} from "./db";
import {authenticateBotKey} from "./bot-api-auth";
export const BOT_API_RATE_LIMIT=60;
export const BOT_API_WINDOW_SECONDS=60;
type AccessResult=
 |{ok:true;ownerId:string;keyId:string;headers:HeadersInit}
 |{ok:false;response:Response};
/** Atomic per-key limiter shared across every strategy owned by the manager.
 * Per-strategy ownership checks also run inside each sensitive transaction. */
export async function authorizeBotV1(request:Request,strategyId?:string):Promise<AccessResult>{
 const identity=await authenticateBotKey(request);
 if(!identity)return {ok:false,response:Response.json({error:"Invalid or revoked manager API key"},{status:401})};
 if(strategyId!==undefined){
  const publicKey=request.headers.get("x-zenvest-strategy-pubkey");
  if(!publicKey)return {ok:false,response:Response.json({error:"X-Zenvest-Strategy-Pubkey header required"},{status:400})};
  const owned=await prisma.bot.findFirst({where:{ownerId:identity.ownerId,strategyId,
    strategy:{publicKey}},select:{id:true}});
  if(!owned)return {ok:false,response:Response.json({error:"Strategy public key does not match an owned strategy"},{status:403})};
 }
 const now=Date.now(),windowStart=new Date(Math.floor(now/60000)*60000);
 const resetSeconds=Math.ceil((windowStart.getTime()+60000-now)/1000);
 try{
  const changed=await prisma.$executeRaw`
   INSERT INTO "bot_api_rate_limits" ("key_id","window_start","request_count")
   VALUES (${identity.keyId},${windowStart},1)
   ON CONFLICT ("key_id","window_start")
   DO UPDATE SET "request_count" = "bot_api_rate_limits"."request_count" + 1
   WHERE "bot_api_rate_limits"."request_count" < ${BOT_API_RATE_LIMIT}
  `;
  const headers:HeadersInit={"Cache-Control":"no-store","X-RateLimit-Limit":String(BOT_API_RATE_LIMIT),
   "X-RateLimit-Reset":String(Math.ceil((windowStart.getTime()+60000)/1000))};
  if(changed!==1){
   await prisma.botApiRateLimit.updateMany({where:{keyId:identity.keyId,windowStart},data:{rejectedCount:{increment:1}}});
   return {ok:false,response:Response.json(
   {error:"API key rate limit exceeded",retry_after_seconds:resetSeconds},
   {status:429,headers:{...headers,"Retry-After":String(resetSeconds)}})};
  }
  const valid=await prisma.botApiKey.updateMany({where:{id:identity.keyId,ownerId:identity.ownerId,revokedAt:null},data:{lastUsedAt:new Date()}});
  if(valid.count!==1)return {ok:false,response:Response.json({error:"API key was revoked"},{status:401})};
  return {ok:true,...identity,headers};
 }catch{
  return {ok:false,response:Response.json({error:"API rate limit unavailable"},{status:503})};
 }
}
