import {NextResponse} from "next/server";
import {requireUser} from "@/lib/access";
import {isValidSolanaAddress} from "@/lib/solana-address";
import {estimateWithdrawalNetworkFee} from "@/lib/blockradar-withdrawal-fee";

export const runtime="nodejs";
export const dynamic="force-dynamic";

// Blockradar has a documented authenticated network-fee quotation endpoint,
// not a confirmed stand-alone address-verification endpoint. A successful
// quotation is a provider preflight check, NOT proof of wallet ownership,
// destination screening or eventual payout success.
export async function POST(request:Request){
 await requireUser();
 if(process.env.BLOCKRADAR_WITHDRAWALS_ENABLED!=="true")
  return NextResponse.json({valid:false,error:"Withdrawals are disabled"},{status:503});
 let body:unknown;
 try{body=await request.json();}catch{
  return NextResponse.json({valid:false,error:"Invalid JSON"},{status:400});
 }
 const address=body&&typeof body==="object"&&!Array.isArray(body)?(body as Record<string,unknown>).address:null;
 if(!isValidSolanaAddress(address))
  return NextResponse.json({valid:false,error:"Enter a valid Solana wallet address"},{status:400,headers:{"Cache-Control":"no-store"}});
 try{
  // Preflight a small 1 USDC transfer through the actual Blockradar Solana USDC
  // fee-quotation API. No transfer or funds reservation is created.
  await estimateWithdrawalNetworkFee(address,1000000n);
  return NextResponse.json({valid:true,address,network:"solana",providerCheck:"fee_quote_accepted"},
   {headers:{"Cache-Control":"no-store"}});
 }catch{
  // Errors, bad credentials, timeouts and provider rejection all fail closed.
  return NextResponse.json({valid:false,error:"Unable to verify this address with Blockradar. Please retry."},
   {status:503,headers:{"Cache-Control":"no-store"}});
 }
}
