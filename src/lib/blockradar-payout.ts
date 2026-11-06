import {formatMicros} from "./withdrawal-network-fee.ts";
export type Payout={id:string;userId:string;address:string;amount:bigint};
export function withdrawalReference(id:string){return `withdrawal:${id}`;}
export type BlockradarTransfer={reference:string;address:string;amount:bigint;metadata:Record<string,string>};
/** Shared HTTP transport; neither provider acceptance nor this wrapper settles a transfer.
 * Only a durable claimed worker may call this function.
 */
export async function submitBlockradarWithdrawal(input:BlockradarTransfer,config:{key:string;walletId:string;assetId:string},send:typeof fetch=fetch,allowInvestorReference=false){
 if(!(allowInvestorReference?/^withdrawal:[a-zA-Z0-9_-]{1,100}$/.test(input.reference):/^platform_withdrawal:[a-zA-Z0-9_-]{8,100}$/.test(input.reference)))throw new Error("Invalid payout reference");
 if(input.amount<=0n||!input.metadata||typeof input.metadata!=="object")throw new Error("Invalid payout input");
 const reference=input.reference;
 const response=await send(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(config.walletId)}/withdraw`,{
  method:"POST",headers:{"x-api-key":config.key,"Content-Type":"application/json"},
  body:JSON.stringify({assetId:config.assetId,address:input.address,amount:formatMicros(input.amount),reference,metadata:input.metadata}),
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

/** Keep the existing investor payout contract unchanged. */
export async function submitBlockradarPayout(input:Payout,config:{key:string;walletId:string;assetId:string},send:typeof fetch=fetch){
 return submitBlockradarWithdrawal({reference:withdrawalReference(input.id),address:input.address,amount:input.amount,metadata:{userId:input.userId}},config,send,true);
}
export function platformWithdrawalReference(id:string){return `platform_withdrawal:${id}`}
