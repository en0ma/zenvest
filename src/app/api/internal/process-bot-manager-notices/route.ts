import {authorizedCron} from "@/lib/cron-auth";
import {deliverBotManagerNotices} from "@/lib/bot-manager-notices";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!authorizedCron(request))return Response.json({error:"Unauthorized"},{status:401});
 try{
  return Response.json({results:await deliverBotManagerNotices()},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Bot Manager notification delivery unavailable"},{status:503})}
}
