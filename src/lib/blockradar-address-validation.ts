import "server-only";
import {isValidSolanaAddress} from "./solana-address";

// Blockradar Validate Address API: GET /v1/addresses/validate
// Docs: https://docs.blockradar.co/en/api-reference/addresses/validate-address
// HTTP 200 may contain isValid:false. This checks syntax, not ownership or AML.
export async function validateBlockradarSolanaAddress(address:string):Promise<boolean>{
 if(!isValidSolanaAddress(address))return false;
 const key=process.env.BLOCK_RADAR_API_KEY;
 if(!key)throw new Error("Blockradar API key is not configured");
 const url=new URL("https://api.blockradar.co/v1/addresses/validate");
 url.searchParams.set("address",address);
 url.searchParams.set("blockchain","solana");
 const response=await fetch(url,{
  method:"GET",headers:{"x-api-key":key},cache:"no-store",
  signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw new Error("Blockradar address validation unavailable");
 const payload:unknown=await response.json();
 if(!payload||typeof payload!=="object"||!("data" in payload))throw new Error("Malformed Blockradar address validation response");
 const data=(payload as {data:unknown}).data;
 if(!data||typeof data!=="object")throw new Error("Missing Blockradar address validation result");
 const result=data as {isValid?:unknown;address?:unknown;blockchain?:unknown};
 if(result.blockchain!=="solana"||result.address!==address||typeof result.isValid!=="boolean")
  throw new Error("Mismatched Blockradar address validation response");
 return result.isValid;
}
