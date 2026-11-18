import {prisma} from "@/lib/db";
import {authorizedCron} from "@/lib/cron-auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Best-effort bounded retention for per-key fixed-window counters.
 * Preserve recent audit data and never change current-window accounting.
 * Runs as a protected Vercel cron; no manager-facing delete endpoint. */
const RETENTION_DAYS=30;
const MAX_ROWS_PER_RUN=1000;
export async function GET(request:Request){
 if(!authorizedCron(request))
  return Response.json({error:"Unauthorized"},{status:401,headers:{"Cache-Control":"no-store"}});
 const cutoff=new Date(Date.now()-RETENTION_DAYS*24*60*60*1000);
 try{
  const deleted=await prisma.$executeRaw`
   WITH expired AS (
    SELECT ctid FROM "bot_api_rate_limits"
    WHERE "window_start" < ${cutoff}
    ORDER BY "window_start" ASC
    LIMIT ${MAX_ROWS_PER_RUN}
    FOR UPDATE SKIP LOCKED
   )
   DELETE FROM "bot_api_rate_limits"
   WHERE ctid IN (SELECT ctid FROM expired)
  `;
  return Response.json({deleted,retention_days:RETENTION_DAYS,batch_limit:MAX_ROWS_PER_RUN},
   {headers:{"Cache-Control":"no-store"}});
 }catch{
  return Response.json({error:"Rate-limit cleanup unavailable"},{status:503,
   headers:{"Cache-Control":"no-store"}});
 }
}
