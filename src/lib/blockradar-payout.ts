import {formatMicros} from "./withdrawal-network-fee.ts";
export type Payout={id:string;userId:string;address:string;amount:bigint};
export function withdrawalReference(id:string){return id;}
export async function submitBlockradarPayout(input:Payout,config:{key:string;walletId:string;assetId:string},send:typeof fetch=fetch){
 const reference=withdrawalReference(input.id);
 const response=await send(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(config.walletId)}/withdraw`,{
  method:"POST",headers:{"x-api-key":config.key,"Content-Type":"application/json"},
  body:JSON.stringify({assetId:config.assetId,address:input.address,amount:formatMicros(input.amount),reference,metadata:{userId:input.userId}}),
  signal:AbortSignal.timeout(15000),cache:"no-store"
 });
 // Blockradar payout submission is asynchronous. HTTP 200 acknowledges
 // acceptance, not settlement. A signed webhook determines the final state.
 if(response.status!==200)throw new Error("Blockradar did not accept payout");
 let body:unknown=null;
 try{body=await response.json();}catch{}
 const root=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const data=root.data&&typeof root.data==="object"?root.data as Record<string,unknown>:{};
 // Keep provider identifiers when supplied, but they are not a prerequisite:
 // Blockradar may acknowledge an asynchronous request without a transaction ID.
 return {id:typeof data.id==="string"?data.id:null,hash:typeof data.hash==="string"?data.hash:null};
}
