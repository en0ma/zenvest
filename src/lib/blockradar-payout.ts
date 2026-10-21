import {formatMicros} from "./withdrawal-network-fee.ts";
export type Payout={id:string;address:string;amount:bigint};
export function withdrawalReference(id:string){return `zenvest-withdrawal:${id}`;}
export async function submitBlockradarPayout(input:Payout,config:{key:string;walletId:string;assetId:string},send:typeof fetch=fetch){
 const reference=withdrawalReference(input.id);
 const response=await send(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(config.walletId)}/withdraw`,{
  method:"POST",headers:{"x-api-key":config.key,"Content-Type":"application/json"},
  body:JSON.stringify({assetId:config.assetId,address:input.address,amount:formatMicros(input.amount),reference}),
  signal:AbortSignal.timeout(15000),cache:"no-store"
 });
 if(!response.ok)throw new Error(`Blockradar withdrawal response HTTP ${response.status}`);
 const body:unknown=await response.json();
 if(!body||typeof body!=="object")throw new Error("Malformed Blockradar payout result");
 const root=body as Record<string,unknown>;
 const data=root.data&&typeof root.data==="object"?root.data as Record<string,unknown>:{};
 if(root.statusCode!==200||typeof data.id!=="string"||!data.id||
    data.reference!==reference||data.recipientAddress!==input.address||
    data.amount!==formatMicros(input.amount)||!["PENDING","PROCESSING","SUCCESS"].includes(String(data.status)))
  throw new Error("Blockradar payout acknowledgement mismatch");
 return {id:data.id,hash:typeof data.hash==="string"?data.hash:null};
}
