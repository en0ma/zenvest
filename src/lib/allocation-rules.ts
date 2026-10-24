/** Deterministic allocation checks; external Kalshi transport must remain mocked/off. */
export function availableUnallocated(unallocated:bigint,pendingWithdrawals:bigint,pendingAllocations:bigint):bigint{
 if(unallocated<0n||pendingWithdrawals<0n||pendingAllocations<0n)throw new Error("Invalid negative reservation");
 const remaining=unallocated-pendingWithdrawals-pendingAllocations;
 return remaining>0n?remaining:0n;
}
export function canRequestAllocation(input:{
 amount:bigint;minimum:bigint;maximum:bigint;capacity:bigint;
 pendingStrategy:bigint;availableUser:bigint;active:boolean;isPublic:boolean;
}):boolean{
 const {amount,minimum,maximum,capacity,pendingStrategy,availableUser,active,isPublic}=input;
 return active&&isPublic&&minimum>0n&&maximum>=minimum&&pendingStrategy>=0n&&
  amount>=minimum&&amount<=maximum&&amount<=availableUser&&amount<=capacity&&
  pendingStrategy+amount<=capacity;
}
