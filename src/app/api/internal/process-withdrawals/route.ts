import {NextResponse} from "next/server";
import {authorizedCron} from "@/lib/cron-auth";
import {processPendingWithdrawal} from "@/lib/withdrawal-payout-worker";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!authorizedCron(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 try{
  const outcome=await processPendingWithdrawal();
  return NextResponse.json({outcome},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  console.error(JSON.stringify({component:"withdrawal-worker",outcome:"review_required",errorType:error instanceof Error?error.name:"unknown"}));
  return NextResponse.json({error:"Withdrawal payout requires review"},{status:503});
 }
}
