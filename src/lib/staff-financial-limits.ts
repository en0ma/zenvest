/** Only known administrative operations may carry payloads. Never expose balance edits. */
import {validateAdminWalletTransfer} from "./staff-wallet-policy.ts";
import type {AdminWalletTransferPayload} from "./staff-wallet-policy";
export type FinancialProposalPayload=Record<string,never>|AdminWalletTransferPayload;
export function validateProposalPayload(
 resource:string,operation:string,value:unknown,_limit:unknown
):{ok:true;payload:FinancialProposalPayload}|{ok:false;reason:string}{
 if(resource==="balances"&&operation==="adjust")return {ok:false,reason:"BALANCE_ADJUSTMENTS_NOT_ALLOWED"};
 if(resource==="wallets"&&operation==="operate")return validateAdminWalletTransfer(value);
 if(value===undefined||value===null||(typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).length===0))return {ok:true,payload:{}};
 return {ok:false,reason:"UNSUPPORTED_PAYLOAD"};
}
