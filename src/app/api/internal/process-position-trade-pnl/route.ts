import {NextResponse} from "next/server";
import {authorizedCron} from "@/lib/cron-auth";
import {processPositionTradePnl} from "@/lib/position-trade-pnl-worker";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!authorizedCron(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 try{return NextResponse.json({results:await processPositionTradePnl()},{headers:{"Cache-Control":"no-store"}});}
 catch(error){console.error(JSON.stringify({component:"position-trade-pnl",errorType:error instanceof Error?error.name:"unknown"}));
  return NextResponse.json({error:"P&L worker failed; no partial posting committed"},{status:503});}
}
