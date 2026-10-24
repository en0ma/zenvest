import {NextResponse} from "next/server";
import {blockradarConfig} from "@/lib/blockradar";
import {executeBlockradarCron} from "@/lib/blockradar-cron-execution";
import {journeyLog} from "@/lib/journey-log";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const result=await executeBlockradarCron(request,"rescan",blockradarConfig);
 if(result.status!==401)journeyLog(result.status===200?"info":"error","blockradar_rescan_cron",result.status===200?"requested":"request_failed",{});
 return NextResponse.json(result.body,{status:result.status,headers:{"Cache-Control":"no-store"}});
}
