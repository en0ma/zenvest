import {NextResponse} from "next/server";
import {requireUser} from "@/lib/access";
import {isValidSolanaAddress} from "@/lib/solana-address";
import {validateBlockradarSolanaAddress} from "@/lib/blockradar-address-validation";

export const runtime="nodejs";
export const dynamic="force-dynamic";

// Blockradar validates the Solana public-key format, not wallet ownership or AML status.
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
  const valid=await validateBlockradarSolanaAddress(address);
  if(!valid)return NextResponse.json({valid:false,error:"Blockradar rejected this Solana address"},
   {status:200,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({valid:true,address,network:"solana",providerCheck:"address_validated"},
   {headers:{"Cache-Control":"no-store"}});
 }catch{
  // Errors, bad credentials, timeouts and provider rejection all fail closed.
  return NextResponse.json({valid:false,error:"Unable to verify this address with Blockradar. Please retry."},
   {status:503,headers:{"Cache-Control":"no-store"}});
 }
}
