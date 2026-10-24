export const ACTIVE_TRANSFER_STATUSES=["PENDING","SUBMITTING","PROCESSING","REVIEW"] as const;
export type TransferStatus="PENDING"|"SUBMITTING"|"PROCESSING"|"REVIEW"|"COMPLETED"|"FAILED"|"CANCELLED";
export function withdrawalWebhookTarget(event:string,providerStatus:unknown):TransferStatus|null{
 if(event==="withdraw.success"&&providerStatus==="SUCCESS")return "COMPLETED";
 if(event==="withdraw.failed"&&providerStatus==="FAILED")return "FAILED";
 if(event==="withdraw.cancelled"&&providerStatus==="CANCELLED")return "CANCELLED";
 return null;
}
export function availableUnallocatedAfterReservations(balance:bigint,pendingWithdrawalsGross:bigint,pendingAllocations:bigint):bigint{
 if(balance<0n||pendingWithdrawalsGross<0n||pendingAllocations<0n)throw new Error("Negative balance or reservation");
 const available=balance-pendingWithdrawalsGross-pendingAllocations;
 return available>0n?available:0n;
}
