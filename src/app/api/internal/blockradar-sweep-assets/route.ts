import {NextResponse} from "next/server";
import {authorizedCron} from "@/lib/cron-auth";
import {blockradarConfig} from "@/lib/blockradar";
import {requestBlockradarWalletAction} from "@/lib/blockradar-wallet-actions";
import {journeyLog} from "@/lib/journey-log";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!authorizedCron(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 try{
  await requestBlockradarWalletAction("sweep",blockradarConfig());
  journeyLog("info","blockradar_sweep_cron","requested",{});
  // Provider ACK only: balance credit remains restricted to verified sweep webhook.
  return NextResponse.json({status:"requested",action:"sweep"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  journeyLog("error","blockradar_sweep_cron","request_failed",{errorType:error instanceof Error?error.name:"unknown"});
  return NextResponse.json({error:"Blockradar sweep request failed"},{status:503});
 }
}
