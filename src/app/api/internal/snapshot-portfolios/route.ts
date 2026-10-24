import {NextResponse} from "next/server";
import {authorizedCron} from "@/lib/cron-auth";
import {captureHourlyPortfolioSnapshots} from "@/lib/hourly-portfolio-snapshot-worker";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!authorizedCron(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 try{
  const outcome=await captureHourlyPortfolioSnapshots();
  return NextResponse.json(outcome,{status:outcome.retryNeeded?503:200,
   headers:{"Cache-Control":"no-store"}});
 }catch(error){
  console.error(JSON.stringify({component:"hourly-portfolio-snapshot",
   errorType:error instanceof Error?error.name:"unknown"}));
  return NextResponse.json({error:"Portfolio snapshot worker unavailable"},{status:503});
 }
}
