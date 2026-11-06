/** These are treasury classifications, never a proxy for the full master on-chain balance. */
export const MASTER_WALLET_SPEND_KINDS=["M_BANK","DEPOSIT_FEE","WITHDRAWAL_FEE"] as const;
export const KALSHI_RETURN_SOURCE="K_BANK" as const;
export const KALSHI_RETURN_DESTINATION="M_BANK" as const;
export type AdminWalletTransferKind="MASTER_TO_WALLET"|"KALSHI_TO_MASTER";
export type AdminWalletTransferPayload={
 kind:AdminWalletTransferKind;
 amountUsdcMicros:string;
 destinationAddress?:string;
};
const positive=/^[1-9][0-9]{0,17}$/;
const address=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** No arbitrary source, destination, asset or fee override accepted from browser. */
export function validateAdminWalletTransfer(value:unknown,limit:unknown):
 {ok:true;payload:AdminWalletTransferPayload}|{ok:false;reason:string}{
 if(!value||typeof value!=="object"||Array.isArray(value))return {ok:false,reason:"INVALID_WALLET_TRANSFER"};
 const data=value as Record<string,unknown>;
 if(data.kind!=="MASTER_TO_WALLET"&&data.kind!=="KALSHI_TO_MASTER")return {ok:false,reason:"UNSUPPORTED_WALLET_OPERATION"};
 const keys=Object.keys(data).sort().join(",");
 if(keys!==(data.kind==="MASTER_TO_WALLET"?"amountUsdcMicros,destinationAddress,kind":"amountUsdcMicros,kind"))
  return {ok:false,reason:"INVALID_WALLET_FIELDS"};
 if(typeof data.amountUsdcMicros!=="string"||!positive.test(data.amountUsdcMicros))return {ok:false,reason:"INVALID_WALLET_AMOUNT"};
 // A cap is optional. When supplied, an invalid cap fails closed.
 if(limit!==undefined&&limit!==null&&limit!==""){
  if(typeof limit!=="string"||!positive.test(limit))return {ok:false,reason:"INVALID_WALLET_TRANSFER_LIMIT"};
  if(BigInt(data.amountUsdcMicros)>BigInt(limit))return {ok:false,reason:"WALLET_TRANSFER_LIMIT_EXCEEDED"};
 }
 if(data.kind==="MASTER_TO_WALLET"&&(typeof data.destinationAddress!=="string"||!address.test(data.destinationAddress)))
  return {ok:false,reason:"INVALID_DESTINATION"};
 return {ok:true,payload:data.kind==="MASTER_TO_WALLET"?
  {kind:data.kind,amountUsdcMicros:data.amountUsdcMicros,destinationAddress:data.destinationAddress as string}:
  {kind:data.kind,amountUsdcMicros:data.amountUsdcMicros}};
}
export type TreasuryBalances={M_BANK:bigint;DEPOSIT_FEE:bigint;WITHDRAWAL_FEE:bigint;K_BANK:bigint};
type FundingResult={ok:true;amount:bigint;debits:{M_BANK:bigint;DEPOSIT_FEE:bigint;WITHDRAWAL_FEE:bigint;K_BANK:bigint}}|{ok:false;reason:string};
/** Reservations are deducted before determining spendable funds. Never spend DEPOSIT,
 * DEALLOCATE or ALLOCATE; never count K_BANK toward master custody.
 */
export function planAdminWalletFunding(kind:AdminWalletTransferKind,amount:bigint,balances:TreasuryBalances,reserved:bigint=0n):FundingResult{
 if(amount<=0n||reserved<0n||Object.values(balances).some(x=>x<0n))return {ok:false,reason:"INVALID_TREASURY_STATE"};
 const zero={M_BANK:0n,DEPOSIT_FEE:0n,WITHDRAWAL_FEE:0n,K_BANK:0n};
 if(kind==="KALSHI_TO_MASTER"){
  if(amount>balances.K_BANK-reserved)return {ok:false,reason:"INSUFFICIENT_K_BANK"};
  return {ok:true,amount,debits:{...zero,K_BANK:amount}};
 }
 let remaining=amount+reserved;
 const result={...zero};
 for(const key of MASTER_WALLET_SPEND_KINDS){
  const debit=balances[key]<remaining?balances[key]:remaining;
  result[key]=debit;remaining-=debit;
 }
 if(remaining>0n)return {ok:false,reason:"INSUFFICIENT_PLATFORM_FUNDS"};
 // Deduct reservations from M_BANK first, then fee buckets; return only the spend.
 let toReserve=reserved;
 for(const key of MASTER_WALLET_SPEND_KINDS){
  const reservation=result[key]<toReserve?result[key]:toReserve;
  result[key]-=reservation;toReserve-=reservation;
 }
 return {ok:true,amount,debits:result};
}

/** The Kalshi destination is derived exclusively from the configured master custody
 * record. A proposal never contains a destination override. This is validation
 * for future execution and does not itself submit a provider transfer.
 */
export function resolveKalshiReturnDestination(master:{
 source:string;kind:string;walletId:string;walletAddress:string;asset:string;network:string
},configuredMasterWalletId:string):string|null{
 if(master.source!=="MASTER_WALLET"||master.kind!=="DEPOSIT"||master.walletId!==configuredMasterWalletId||
 master.asset!=="USDC"||master.network!=="solana"||!address.test(master.walletAddress))return null;
 return master.walletAddress;
}
