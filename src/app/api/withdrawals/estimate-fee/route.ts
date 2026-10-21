import {NextResponse} from "next/server";
import {requireUser} from "@/lib/access";
import {estimateWithdrawalNetworkFee} from "@/lib/blockradar-withdrawal-fee";
import {parsePositiveUsdcMicros} from "@/lib/blockradar-event-validation";
import {WITHDRAWAL_FEE_USDC_MICROS} from "@/lib/withdrawal-fee";
import {withdrawalFeeBreakdown} from "@/lib/withdrawal-network-fee";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 await requireUser();
 if(process.env.BLOCKRADAR_WITHDRAWALS_ENABLED!=="true")return NextResponse.json({error:"Withdrawals are disabled"},{status:503});
 let input:unknown;
 try{input=await request.json();}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 if(!input||typeof input!=="object")return NextResponse.json({error:"Invalid request"},{status:400});
 const body=input as Record<string,unknown>;
 const gross=parsePositiveUsdcMicros(body.amount);
 const address=body.address;
 if(!gross||gross<=WITHDRAWAL_FEE_USDC_MICROS||typeof address!=="string"||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))return NextResponse.json({error:"Invalid withdrawal details"},{status:400});
 try{
  const network=await estimateWithdrawalNetworkFee(address,gross-WITHDRAWAL_FEE_USDC_MICROS);
  const fees=withdrawalFeeBreakdown(gross,network);
  return NextResponse.json({serviceFeeMicros:fees.service.toString(),networkFeeMicros:fees.network.toString(),totalFeeMicros:fees.total.toString(),netMicros:fees.net.toString()},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Unable to estimate the network fee; withdrawal cannot proceed"},{status:503});}
}
