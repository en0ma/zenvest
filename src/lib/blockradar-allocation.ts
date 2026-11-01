import {formatMicros} from "./withdrawal-network-fee.ts";
export async function submitBlockradarAllocation(input:{reference:string;strategyId:string;address:string;amount:bigint},config:{key:string;walletId:string;assetId:string},send:typeof fetch=fetch){
 if(input.amount<=0n)throw new Error("Allocation amount must be positive");
 const response=await send(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(config.walletId)}/withdraw`,{
  method:"POST",headers:{"x-api-key":config.key,"Content-Type":"application/json"},
  body:JSON.stringify({assetId:config.assetId,address:input.address,amount:formatMicros(input.amount),reference:input.reference,metadata:{strategyId:input.strategyId,kind:"allocation"}}),
  signal:AbortSignal.timeout(15000),cache:"no-store",
 });
 if(response.status!==200)throw new Error("Blockradar allocation payout not accepted");
 let body:unknown;
 try{body=await response.json();}catch{return {id:null,hash:null};}
 const root=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const data=root.data&&typeof root.data==="object"?root.data as Record<string,unknown>:{};
 return {id:typeof data.id==="string"?data.id:null,hash:typeof data.hash==="string"?data.hash:null};
}
