export function masterCustodyCoversTreasury(balance:bigint,deposit:bigint,deallocate:bigint){
 if(balance<0n||deposit<0n||deallocate<0n)throw new Error("Invalid custody balances");
 return balance>=deposit+deallocate;
}
