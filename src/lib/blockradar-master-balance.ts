import {parsePositiveUsdcMicros} from "./blockradar-event-validation.ts";
export async function readBlockradarUsdcBalance(config:{key:string;walletId:string;assetId:string},send:typeof fetch=fetch):Promise<bigint>{
 const url=new URL(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(config.walletId)}/balance`);
 url.searchParams.set("assetId",config.assetId);
 const response=await send(url,{headers:{"x-api-key":config.key},cache:"no-store",signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error("Blockradar balance request failed");
 const body:unknown=await response.json();
 if(!body||typeof body!=="object")throw new Error("Malformed master balance");
 const root=body as Record<string,unknown>;
 const data=root.data&&typeof root.data==="object"?root.data as Record<string,unknown>:null;
 if(root.statusCode!==200||!data)throw new Error("Missing master balance");
 const asset=data.asset;
 if((typeof asset==="string"&&asset!=="USDC") || (asset&&typeof asset==="object"&&"symbol" in asset&&(asset as {symbol:unknown}).symbol!=="USDC"))
  throw new Error("Unexpected Blockradar balance asset");
 // Only accept unambiguous USDC-denominated balance; never infer available funds
 // from unrelated assets or from a total balance across tokens.
 const balance=parsePositiveUsdcMicros(data.balance);
 if(balance===null)throw new Error("Missing positive confirmed USDC master balance");
 return balance;
}
