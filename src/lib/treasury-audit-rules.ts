/** Pure, read-only assertions over treasury accounting snapshots.
 * No inferred provider outcome is allowed to trigger a balance mutation. */
export const ACTIVE_TREASURY_KINDS=[
 "DEPOSIT","ALLOCATE","DEPOSIT_FEE","WITHDRAWAL_FEE","M_BANK","K_BANK",
] as const;
export type TreasuryKindName=(typeof ACTIVE_TREASURY_KINDS)[number];
export type AuditSeverity="critical"|"warning";
export type AuditFinding={
 code:string;severity:AuditSeverity;count:number;sampleIds:string[];detail:string;
};
export type TreasuryRow={
 kind:string;source:string;asset:string;network:string;walletId:string;walletAddress:string;amount:bigint;
};
export type LinkedWithdrawal={
 id:string;status:string;amountUsdcMicros:bigint;grossUsdcMicros:bigint;feeUsdcMicros:bigint;
 treasuryTransactionId:string|null;treasuryTransaction:{
  id:string;direction:string;status:string;reference:string;amountUsdcMicros:bigint;feeUsdcMicros:bigint;
 }|null;
};
export type StaffReturnLedger={
 id:string;amountUsdcMicros:bigint;reference:string;originExternalId:string|null;
 destinationExternalId:string|null;status:string;direction:string;
};
export function finding(code:string,severity:AuditSeverity,count:number,detail:string,sampleIds:string[]=[]):AuditFinding{
 return {code,severity,count,detail,sampleIds:sampleIds.slice(0,5)};
}
export function auditTreasuryBuckets(rows:TreasuryRow[]):AuditFinding[]{
 const issues:AuditFinding[]=[];
 const known=new Set<string>(ACTIVE_TREASURY_KINDS);
 const seen=new Set<string>();
 for(const row of rows){
  if(!known.has(row.kind))issues.push(finding("UNEXPECTED_TREASURY_BUCKET","critical",1,"Inactive balance bucket exists",[row.kind]));
  if(seen.has(row.kind))issues.push(finding("DUPLICATE_TREASURY_BUCKET","critical",1,"Multiple balance rows for one kind",[row.kind]));
  seen.add(row.kind);
  if(row.amount<0n)issues.push(finding("NEGATIVE_TREASURY_BALANCE","critical",1,"Negative ledger amount",[row.kind]));
  const kalshi=row.kind==="ALLOCATE"||row.kind==="K_BANK";
  if(row.asset!=="USDC"||row.network!=="solana"||row.source!==(kalshi?"KALSHI":"MASTER_WALLET")||
     !row.walletId||!row.walletAddress)
   issues.push(finding("TREASURY_CUSTODY_IDENTITY","critical",1,"Invalid bucket custody identity",[row.kind]));
 }
 for(const kind of ACTIVE_TREASURY_KINDS)if(!seen.has(kind))
  issues.push(finding("MISSING_TREASURY_BUCKET","critical",1,"Required balance bucket missing",[kind]));
 const master=rows.find(r=>r.kind==="DEPOSIT");
 if(master)for(const row of rows.filter(x=>["DEPOSIT_FEE","WITHDRAWAL_FEE","M_BANK"].includes(x.kind))){
  if(row.walletId!==master.walletId||row.walletAddress!==master.walletAddress)
   issues.push(finding("MASTER_BUCKET_MISMATCH","critical",1,"Master-held buckets must share custody identity",[row.kind]));
 }
 return issues;
}
export type PlatformReservationRow={
 id:string;amountUsdcMicros:bigint;
 reservedMBankMicros:bigint;reservedDepositFeeMicros:bigint;reservedWithdrawalFeeMicros:bigint;
};
/** Check each active reservation separately: a negative component must not be
 * hidden by another withdrawal's positive reserve or by the aggregate sum. */
export function auditPlatformReservations(rows:PlatformReservationRow[]):AuditFinding[]{
 const issues:AuditFinding[]=[];
 for(const row of rows){
  const parts=[row.reservedMBankMicros,row.reservedDepositFeeMicros,row.reservedWithdrawalFeeMicros];
  if(row.amountUsdcMicros<=0n||parts.some(amount=>amount<0n)||
     parts.reduce((sum,amount)=>sum+amount,0n)!==row.amountUsdcMicros)
   issues.push(finding("PLATFORM_RESERVATION_MISMATCH","critical",1,
    "Active platform payout has invalid or inconsistent reserved treasury amounts",[row.id]));
 }
 return issues;
}
export function expectedMasterMicros(rows:TreasuryRow[]):bigint{
 return rows.filter(r=>["DEPOSIT","DEPOSIT_FEE","WITHDRAWAL_FEE","M_BANK"].includes(r.kind))
  .reduce((n,r)=>n+r.amount,0n);
}
export function compareMasterCustody(expected:bigint,observed:bigint,hasTransfersInFlight:boolean):AuditFinding[]{
 if(expected<0n||observed<0n)return [finding("INVALID_MASTER_CUSTODY_AMOUNT","critical",1,"Negative custody or claims")];
 if(expected===observed)return [];
 return [finding("MASTER_CUSTODY_DIFFERENCE","warning",1,
  "Verified Blockradar balance differs from recorded master claims"+
  (hasTransfersInFlight?"; transfers are in flight, investigate before interpreting as a shortfall":"; investigate custody movements and accounting history"))];
}
export function auditCompletedWithdrawal(row:LinkedWithdrawal):AuditFinding[]{
 if(row.status!=="COMPLETED")return [];
 const entry=row.treasuryTransaction;
 if(!row.treasuryTransactionId||!entry)return [finding("COMPLETED_WITHDRAWAL_LEDGER_MISSING","critical",1,"Completed withdrawal lacks a ledger entry",[row.id])];
 if(entry.id!==row.treasuryTransactionId||entry.direction!=="WITHDRAWAL"||entry.status!=="COMPLETE"||
    entry.reference!=="withdrawal:"+row.id||entry.amountUsdcMicros!==row.amountUsdcMicros||
    entry.feeUsdcMicros!==row.feeUsdcMicros||row.grossUsdcMicros!==row.amountUsdcMicros+row.feeUsdcMicros)
  return [finding("COMPLETED_WITHDRAWAL_LEDGER_MISMATCH","critical",1,"Completed payout and ledger disagree",[row.id])];
 return [];
}
export function auditStaffReturnPair(out:StaffReturnLedger,back:StaffReturnLedger|null):AuditFinding[]{
 if(!back||out.direction!=="K_BANK_WITHDRAWAL"||back.direction!=="M_BANK_DEPOSIT"||
 out.amountUsdcMicros!==back.amountUsdcMicros||out.status!=="COMPLETE"||back.status!=="COMPLETE"||
 out.originExternalId!==back.originExternalId||out.destinationExternalId!==back.destinationExternalId)
  return [finding("STAFF_RETURN_PAIR_MISMATCH","critical",1,"Kalshi outbound and master inbound ledger entries do not reconcile",[out.id])];
 return [];
}
