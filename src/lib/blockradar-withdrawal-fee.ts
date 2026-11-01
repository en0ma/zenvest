import "server-only";
import {blockradarConfig} from "./blockradar";
import {formatMicros,parseBlockradarNetworkFee,assertSufficientNativeGas} from "./withdrawal-network-fee";
export async function estimateWithdrawalNetworkFee(address:string,netAmount:bigint,requireNativeGas=false):Promise<bigint>{
 const assetId=process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID;
 if(!assetId)throw new Error("Blockradar USDC asset ID not configured");
 const {key,walletId}=blockradarConfig();
 const response=await fetch(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(walletId)}/withdraw/network-fee`,{
  method:"POST",headers:{"x-api-key":key,"Content-Type":"application/json"},
  body:JSON.stringify({assetId,address,amount:formatMicros(netAmount)}),
  cache:"no-store",signal:AbortSignal.timeout(12000),
 });
 if(!response.ok)throw new Error("Blockradar fee estimation unavailable");
 const payload:unknown=await response.json();
 if(requireNativeGas)assertSufficientNativeGas(payload);
 return parseBlockradarNetworkFee(payload);
}
