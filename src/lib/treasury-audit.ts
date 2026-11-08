import {Prisma} from "@prisma/client";
import {prisma} from "./db";
import {blockradarConfig} from "./blockradar";
import {readBlockradarUsdcBalance} from "./blockradar-master-balance";
import {
 auditTreasuryBuckets,auditCompletedWithdrawal,auditStaffReturnPair,
 compareMasterCustody,expectedMasterMicros,finding,
 type AuditFinding,type TreasuryRow,
} from "./treasury-audit-rules";

const PAGE_LIMIT=2000;
const SAMPLE_LIMIT=5;
const REVIEW_AGE_MS=2*60*60*1000;
type AuditReport={
 checkedAt:string;complete:boolean;
 findingCount:number;criticalCount:number;warningCount:number;
 findings:AuditFinding[];
 custody:{status:"matched"|"mismatch"|"unavailable";expectedMasterMicros:string;observedMasterMicros:string|null};
};
function append(issues:AuditFinding[],v:AuditFinding[]){issues.push(...v);}
async function loadMasterCustody():Promise<bigint>{
 const {key,walletId}=blockradarConfig();
 const assetId=process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID;
 if(!assetId)throw Error("Master USDC asset is not configured");
 return readBlockradarUsdcBalance({key,walletId,assetId});
}
export async function runTreasuryAudit(options:{
 now?:Date;readCustody?:()=>Promise<bigint>;
}={}):Promise<AuditReport>{
 const now=options.now??new Date();
 if(!Number.isFinite(now.getTime()))throw Error("Invalid audit date");
 const cutoff=new Date(now.getTime()-REVIEW_AGE_MS);
 // Repeatable-read prevents the report itself from mixing half-settled database
 // snapshots. This transaction performs no inserts, updates, or deletes.
 const snapshot=await prisma.$transaction(async tx=>{
  const [buckets,withdrawals,deposits,staffOutbounds,staleWithdrawals,stalePlatform,
         negativeUsers,negativePositions,activeWithdrawals,activePlatform]=await Promise.all([
   tx.treasury.findMany(),
   tx.withdrawal.findMany({where:{status:"COMPLETED"},take:PAGE_LIMIT+1,
    orderBy:{id:"asc"},include:{treasuryTransaction:true}}),
   tx.blockchainDeposit.findMany({where:{status:"CONFIRMED"},take:PAGE_LIMIT+1,
    orderBy:{id:"asc"},include:{treasuryTransaction:true}}),
   tx.treasuryTransfer.findMany({where:{direction:"K_BANK_WITHDRAWAL",status:"COMPLETE"},
    orderBy:{id:"asc"},take:PAGE_LIMIT+1}),
   tx.withdrawal.findMany({where:{status:"REVIEW",updatedAt:{lte:cutoff}},
    orderBy:{updatedAt:"asc"},take:SAMPLE_LIMIT+1,select:{id:true}}),
   tx.platformWithdrawal.findMany({where:{status:"REVIEW",updatedAt:{lte:cutoff}},
    orderBy:{updatedAt:"asc"},take:SAMPLE_LIMIT+1,select:{id:true}}),
   tx.user.findMany({where:{unallocated:{lt:0n}},take:SAMPLE_LIMIT+1,select:{id:true}}),
   tx.investorPosition.findMany({where:{allocatedUsdcMicros:{lt:0n}},take:SAMPLE_LIMIT+1,select:{id:true}}),
   tx.withdrawal.count({where:{status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}}}),
   tx.platformWithdrawal.findMany({where:{status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},
    select:{reservedMBankMicros:true,reservedDepositFeeMicros:true,reservedWithdrawalFeeMicros:true}}),
  ]);
  const returns=staffOutbounds.filter(x=>x.reference.endsWith(":k_bank_withdrawal"));
  const matchRefs=returns.map(x=>x.reference.slice(0,-":k_bank_withdrawal".length));
  const inbound=matchRefs.length?await tx.treasuryTransfer.findMany({where:{reference:{in:matchRefs}}}):[];
  const feeEntries=await tx.treasuryTransfer.findMany({
   where:{direction:"K_BANK_DEPOSIT",status:"COMPLETE"},take:PAGE_LIMIT+1,
   orderBy:{id:"asc"},select:{reference:true,amountUsdcMicros:true}});
  const profitIds=feeEntries.filter(x=>x.reference.startsWith("trade-platform-profit:"))
   .map(x=>x.reference.slice("trade-platform-profit:".length));
  const trades=profitIds.length?await tx.strategyTrade.findMany({where:{id:{in:profitIds}},
   select:{id:true,isPnlCalculated:true,positionTradePnls:{select:{platformFeeUsdcMicros:true,status:true}}}}):[];
  return {buckets,withdrawals,deposits,staffOutbounds,inbound,
   staleWithdrawals,stalePlatform,negativeUsers,negativePositions,activeWithdrawals,activePlatform,
   feeEntries,trades};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:20000});
 const issues:AuditFinding[]=[];
 const buckets=snapshot.buckets as TreasuryRow[];
 append(issues,auditTreasuryBuckets(buckets));
 let complete=true;
 const cap=(name:string,n:number)=>{
  if(n>PAGE_LIMIT){complete=false;issues.push(finding("AUDIT_SCAN_LIMIT","warning",1,
   "Bounded read reached maximum; additional "+name+" records were not audited"));}};
 cap("withdrawal",snapshot.withdrawals.length);
 cap("deposit",snapshot.deposits.length);
 cap("staff return",snapshot.staffOutbounds.length);
 cap("profit",snapshot.feeEntries.length);
 for(const w of snapshot.withdrawals.slice(0,PAGE_LIMIT))
  append(issues,auditCompletedWithdrawal(w));
 for(const d of snapshot.deposits.slice(0,PAGE_LIMIT)){
  const t=d.treasuryTransaction;
  if(!t||!d.treasuryTransactionId||t.status!=="COMPLETE"||t.direction!=="DEPOSIT"||
     t.reference!==d.providerTransactionId||t.amountUsdcMicros!==d.amountUsdcMicros-d.feeUsdcMicros)
   issues.push(finding("CONFIRMED_DEPOSIT_LEDGER_MISMATCH","critical",1,
    "Credited deposit lacks matching completed DEPOSIT ledger",[d.id]));
 }
 const inbound=new Map(snapshot.inbound.map(x=>[x.reference,x]));
 for(const out of snapshot.staffOutbounds.slice(0,PAGE_LIMIT)){
  if(!out.reference.endsWith(":k_bank_withdrawal")){
   issues.push(finding("STAFF_RETURN_REFERENCE_MISMATCH","critical",1,"Invalid staff return reference",[out.id]));
   continue;
  }
  append(issues,auditStaffReturnPair(out,inbound.get(out.reference.slice(0,-":k_bank_withdrawal".length))??null));
 }
 const trades=new Map(snapshot.trades.map(x=>[x.id,x]));
 for(const entry of snapshot.feeEntries.slice(0,PAGE_LIMIT)){
  if(!entry.reference.startsWith("trade-platform-profit:"))continue;
  const id=entry.reference.slice("trade-platform-profit:".length);
  const trade=trades.get(id);
  const sum=trade?.positionTradePnls.reduce((n,p)=>n+(p.platformFeeUsdcMicros??0n),0n);
  if(!trade||!trade.isPnlCalculated||trade.positionTradePnls.some(p=>p.status!=="SETTLED")||
    sum!==entry.amountUsdcMicros||entry.amountUsdcMicros<=0n)
    issues.push(finding("PLATFORM_PROFIT_LEDGER_MISMATCH","critical",1,
     "K_BANK profit journal does not match settled participant fee shares",[id]));
 }
 function sample(code:string,severity:"critical"|"warning",arr:{id:string}[],detail:string){
  if(arr.length)issues.push(finding(code,severity,arr.length,detail,arr.map(x=>x.id)));
 }
 sample("NEGATIVE_INVESTOR_BALANCE","critical",snapshot.negativeUsers,
  "Investor has a negative unallocated balance");
 sample("NEGATIVE_ALLOCATED_EQUITY","critical",snapshot.negativePositions,
  "Position has negative invested equity");
 sample("STALE_INVESTOR_WITHDRAWAL_REVIEW","warning",snapshot.staleWithdrawals,
  "Uncertain investor payout still reserves funds; reconcile provider outcome");
 sample("STALE_PLATFORM_WITHDRAWAL_REVIEW","warning",snapshot.stalePlatform,
  "Uncertain platform payout still reserves platform funds");
 const unreserved=snapshot.activePlatform.reduce((n,w)=>n+
  w.reservedMBankMicros+w.reservedDepositFeeMicros+w.reservedWithdrawalFeeMicros,0n);
 if(unreserved<0n)issues.push(finding("NEGATIVE_PLATFORM_RESERVATION","critical",1,
  "Outstanding platform payout contains negative reservation"));
 const expected=expectedMasterMicros(buckets)+unreserved;
 let observed:bigint|null=null;
 let custodyStatus:AuditReport["custody"]["status"]="unavailable";
 try{
  observed=await (options.readCustody??loadMasterCustody)();
  const mismatch=compareMasterCustody(expected,observed,snapshot.activeWithdrawals>0||snapshot.activePlatform.length>0);
  append(issues,mismatch);
  custodyStatus=mismatch.length?"mismatch":"matched";
 }catch{
  complete=false;
  issues.push(finding("MASTER_CUSTODY_LOOKUP_UNAVAILABLE","warning",1,
   "Blockradar custody evidence unavailable; no balance conclusions can be drawn"));
 }
 return {
  checkedAt:now.toISOString(),complete,
  findingCount:issues.length,criticalCount:issues.filter(x=>x.severity==="critical").length,
  warningCount:issues.filter(x=>x.severity==="warning").length,
  findings:issues,custody:{status:custodyStatus,
   expectedMasterMicros:expected.toString(),observedMasterMicros:observed?.toString()??null},
 };
}
