import {NextResponse} from "next/server";
import {authorizedCron} from "@/lib/cron-auth";
import {processPendingAllocations} from "@/lib/allocation-payout-worker";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!authorizedCron(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 try{
  const outcome=await processPendingAllocations();
  return NextResponse.json({outcome},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  console.error(JSON.stringify({component:"allocation-worker",errorType:error instanceof Error?error.name:"unknown"}));
  return NextResponse.json({error:"Allocation worker failed"},{status:503});
 }
}
