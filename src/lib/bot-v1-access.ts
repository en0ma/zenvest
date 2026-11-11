import {prisma} from "./db";
import {authenticateBotKey} from "./bot-api-auth";
export const BOT_API_RATE_LIMIT=60;
export const BOT_API_WINDOW_SECONDS=60;
type AccessResult=
 |{ok:true;botId:string;ownerId:string;strategyId:string;keyId:string;headers:HeadersInit}
 |{ok:false;response:Response};
/** Atomic database-backed fixed window. Shared across processes and keyed by
 * the actual credential ID; independent bot keys cannot borrow each other's budget. */
export async function authorizeBotV1(request:Request,strategyId?:string):Promise<AccessResult>{
 const identity=await authenticateBotKey(request.headers.get("authorization"));
 if(!identity)return {ok:false,response:Response.json({error:"Invalid or revoked bot API key"},{status:401})};
 if(strategyId!==undefined&&identity.strategyId!==strategyId)
  return {ok:false,response:Response.json({error:"API key is not authorized for this strategy"},{status:403})};
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
  if(changed!==1)return {ok:false,response:Response.json(
   {error:"API key rate limit exceeded",retry_after_seconds:resetSeconds},
   {status:429,headers:{...headers,"Retry-After":String(resetSeconds)}})};
  // This field is informational only; failures to record it must not grant more API requests.
  const stillValid=await prisma.botApiKey.updateMany({where:{id:identity.keyId,revokedAt:null},data:{lastUsedAt:new Date()}});
  if(stillValid.count!==1)return {ok:false,response:Response.json({error:"API key was revoked"},{status:401})};
  return {ok:true,...identity,headers};
 }catch{
  return {ok:false,response:Response.json({error:"API rate limit unavailable"},{status:503})};
 }
}
