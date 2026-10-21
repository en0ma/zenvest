export const MAX_WITHDRAWAL_ATTEMPTS=15;
export function nextWithdrawalAttempt(attempts:number){
 if(!Number.isSafeInteger(attempts)||attempts<0||attempts>=MAX_WITHDRAWAL_ATTEMPTS)
  throw new Error("Withdrawal attempts exhausted");
 const next=attempts+1;
 return {attempts:next,onPreflightFailure:next>=MAX_WITHDRAWAL_ATTEMPTS?"FAILED" as const:"PENDING" as const};
}
export function masterCustodyCoversTreasury(balance:bigint,deposit:bigint,deallocate:bigint){
 if(balance<0n||deposit<0n||deallocate<0n)throw new Error("Invalid custody balances");
 return balance>=deposit+deallocate;
}
