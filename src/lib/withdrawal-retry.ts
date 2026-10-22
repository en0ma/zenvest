export const MAX_WITHDRAWAL_ATTEMPTS=5;
export function scheduleWithdrawalRetry(attempts:number, now:Date){
 if(!Number.isSafeInteger(attempts)||attempts<0||attempts>=MAX_WITHDRAWAL_ATTEMPTS||Number.isNaN(now.getTime()))throw new Error("Invalid attempt");
 const next=attempts+1;
 return {attempts:next,nextRetry:next<MAX_WITHDRAWAL_ATTEMPTS?new Date(now.getTime()+next*15*60_000):null};
}
