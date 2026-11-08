import "server-only";
import {blockradarConfig} from "./blockradar";
import {withdrawalReference} from "./blockradar-payout";

type RecordShape=Record<string,unknown>;
const object=(x:unknown):RecordShape|null=>x!==null&&typeof x==="object"&&!Array.isArray(x)?x as RecordShape:null;
/** Read-only, authenticated provider lookup; NEVER initiates a payout or infers
 * failure from absence in a potentially paginated result set. */
export async function lookupBlockradarWithdrawal(referenceId:string,knownProviderId:string|null,
 send:typeof fetch=fetch):Promise<{kind:"found";data:RecordShape}|{kind:"unresolved";reason:string}>{
 const {key,walletId}=blockradarConfig();
 const reference=withdrawalReference(referenceId);
 const params=new URLSearchParams();
 params.set("type","WITHDRAW");
 if(knownProviderId)params.set("id",knownProviderId);
 const response=await send(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(walletId)}/transactions?${params}`,{
  method:"GET",headers:{"x-api-key":key},cache:"no-store",signal:AbortSignal.timeout(15000),
 });
 if(!response.ok)throw new Error("Blockradar transaction lookup unavailable");
 const body:unknown=await response.json();
 const root=object(body);
 // The documented GET wallet transaction list response has a data array.
 if(!root||!Array.isArray(root.data))throw new Error("Unexpected Blockradar transaction list");
 const matches=(root.data as unknown[]).map(object).filter((v):v is RecordShape=>Boolean(v))
  .filter(row=>row.reference===reference&&row.type==="WITHDRAW"&&(!knownProviderId||row.id===knownProviderId));
 if(matches.length!==1)return {kind:"unresolved",reason:matches.length?"ambiguous_reference":"not_found"};
 const row=matches[0];
 if(typeof row.id!=="string"||!row.id)return {kind:"unresolved",reason:"missing_provider_identity"};
 const wallet=object(row.wallet);
 if(wallet&&wallet.id!==undefined&&wallet.id!==walletId)return {kind:"unresolved",reason:"wallet_mismatch"};
 // This identity is anchored to the authenticated, scoped wallet endpoint.
 return {kind:"found",data:{...row,wallet:{...wallet,id:walletId}}};
}
