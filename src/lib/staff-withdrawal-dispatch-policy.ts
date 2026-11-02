/** Only definitive no-provider-call outcomes may be considered for rearming.
 * Never rearm after provider acceptance, unknown response or a competing claim.
 */
export function classifyStaffDispatchResult(result:string):"SAFE_NO_PROVIDER_ATTEMPT"|"REVIEW"|"PROVIDER_ACCEPTED"{
 if(result==="preflight_retry"||result==="failed_validation")return "SAFE_NO_PROVIDER_ATTEMPT";
 if(result==="submitted")return "PROVIDER_ACCEPTED";
 return "REVIEW";
}
