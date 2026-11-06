/** Investor principal held in master custody is represented only by DEPOSIT.
 * This verifies custody coverage, not shared cross-worker outbound reservations.
 */
export function masterCustodyCoversTreasury(balance:bigint,deposit:bigint){
 if(balance<0n||deposit<0n)throw new Error("Invalid custody balances");
 return balance>=deposit;
}
