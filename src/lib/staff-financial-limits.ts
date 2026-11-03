/** Monetary figures are integer USDC micros. Policy is deny-by-default. */
import {validateAdminWalletTransfer} from "./staff-wallet-policy";
import type {AdminWalletTransferPayload} from "./staff-wallet-policy";
export type BalanceAdjustmentPayload={direction:"CREDIT"|"DEBIT";amountUsdcMicros:string};
export type FinancialProposalPayload=Record<string,never>|BalanceAdjustmentPayload|AdminWalletTransferPayload;
const positiveMicros=/^[1-9][0-9]{0,17}$/;
export function validateBalanceAdjustment(
 value:unknown, configuredLimit:unknown
):{ok:true;payload:BalanceAdjustmentPayload}|{ok:false;reason:string}{
 if(!value||typeof value!=="object"||Array.isArray(value))return {ok:false,reason:"AMOUNT_REQUIRED"};
 const data=value as Record<string,unknown>;
 if(Object.keys(data).sort().join(",")!=="amountUsdcMicros,direction")return {ok:false,reason:"INVALID_ADJUSTMENT_FIELDS"};
 if(data.direction!=="CREDIT"&&data.direction!=="DEBIT")return {ok:false,reason:"INVALID_DIRECTION"};
 if(typeof data.amountUsdcMicros!=="string"||!positiveMicros.test(data.amountUsdcMicros))return {ok:false,reason:"INVALID_AMOUNT"};
 if(typeof configuredLimit!=="string"||!positiveMicros.test(configuredLimit))return {ok:false,reason:"ADJUSTMENTS_NOT_CONFIGURED"};
 const amount=BigInt(data.amountUsdcMicros),limit=BigInt(configuredLimit);
 if(amount>limit)return {ok:false,reason:"ADJUSTMENT_LIMIT_EXCEEDED"};
 return {ok:true,payload:{direction:data.direction,amountUsdcMicros:amount.toString()}};
}
export function validateProposalPayload(
 resource:string,operation:string,value:unknown,limit:unknown,walletLimit?:unknown
):{ok:true;payload:FinancialProposalPayload}|{ok:false;reason:string}{
 if(resource==="balances"&&operation==="adjust")return validateBalanceAdjustment(value,limit);
 if(resource==="wallets"&&operation==="operate")return validateAdminWalletTransfer(value,walletLimit);
 if(value===undefined||value===null||(typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).length===0))return {ok:true,payload:{}};
 return {ok:false,reason:"UNSUPPORTED_PAYLOAD"};
}
