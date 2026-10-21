import {NextResponse} from "next/server";
import {authorizedCron} from "@/lib/cron-auth";
import {blockradarConfig} from "@/lib/blockradar";
import {requestBlockradarWalletAction} from "@/lib/blockradar-wallet-actions";
import {journeyLog} from "@/lib/journey-log";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!authorizedCron(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 if(process.env.BLOCKRADAR_DEPOSITS_ENABLED!=="true"||process.env.BLOCKRADAR_DEPOSIT_FINDER_ENABLED!=="true")
  return NextResponse.json({status:"disabled"},{status:503});
 try{
  await requestBlockradarWalletAction("rescan",blockradarConfig());
  journeyLog("info","blockradar_rescan_cron","requested",{});
  // Provider ACK only: balance credit remains restricted to verified sweep webhook.
  return NextResponse.json({status:"requested",action:"rescan"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  journeyLog("error","blockradar_rescan_cron","request_failed",{errorType:error instanceof Error?error.name:"unknown"});
  return NextResponse.json({error:"Blockradar rescan request failed"},{status:503});
 }
}
