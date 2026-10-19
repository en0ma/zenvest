import Link from "next/link";
import { ArrowUpFromLine, Clock3, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { PageIntro, BalanceTile } from "@/components/investor-ui";
import { WithdrawalForm } from "@/components/withdrawal-actions";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
export const dynamic="force-dynamic";

const PAGE_SIZE=10;
function pageNumber(raw:string|undefined){
  const n=Number(raw??"1");
  return Number.isSafeInteger(n)&&n>0?Math.min(n,100000):1;
}
function date(value:Date|null){
  return value?value.toLocaleString("en-US",{timeZone:"UTC",dateStyle:"medium",timeStyle:"short"})+" UTC":"—";
}
function Pager({page,pages,total,keyName,other}:{page:number;pages:number;total:number;keyName:"withdrawalsPage"|"deallocationsPage";other:number}){
  const href=(n:number)=>"/withdrawals?"+new URLSearchParams({withdrawalsPage:String(keyName==="withdrawalsPage"?n:other),deallocationsPage:String(keyName==="deallocationsPage"?n:other)}).toString();
  const classes="rounded-lg border border-[#DEE5EE] px-3 py-2 text-xs font-semibold text-[#334155] transition hover:border-[#635BFF] hover:text-[#635BFF]";
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF0F5] px-4 py-4 sm:px-5">
    <p className="text-xs text-[#64748B]">{total===0?"0 results":`Showing ${(page-1)*PAGE_SIZE+1}–${Math.min(page*PAGE_SIZE,total)} of ${total}`}</p>
    <nav aria-label={keyName==="withdrawalsPage"?"Withdrawals pages":"Deallocations pages"} className="flex items-center gap-2">
      {page>1?<Link className={classes} href={href(page-1)}>Previous</Link>:<span className={classes+" cursor-not-allowed opacity-40"}>Previous</span>}
      <span className="px-1 text-xs font-medium text-[#64748B]">Page {page} of {pages}</span>
      {page<pages?<Link className={classes} href={href(page+1)}>Next</Link>:<span className={classes+" cursor-not-allowed opacity-40"}>Next</span>}
    </nav>
  </div>;
}

export default async function Withdrawals({searchParams}:{searchParams:Promise<{withdrawalsPage?:string;deallocationsPage?:string}>}){
  const user=await requireUser();
  const params=await searchParams;
  const requestedW=pageNumber(params.withdrawalsPage);
  const requestedD=pageNumber(params.deallocationsPage);
  const [portfolio,withdrawalCount,deallocationCount]=await Promise.all([
    prisma.investorPortfolio.findUnique({where:{userId:user.id}}),
    prisma.investorWithdrawal.count({where:{userId:user.id}}),
    prisma.withdrawalDeallocation.count({where:{userId:user.id}}),
  ]);
  const withdrawalPages=Math.max(1,Math.ceil(withdrawalCount/PAGE_SIZE));
  const deallocationPages=Math.max(1,Math.ceil(deallocationCount/PAGE_SIZE));
  const wPage=Math.min(requestedW,withdrawalPages);
  const dPage=Math.min(requestedD,deallocationPages);
  const [records,deallocations]=await Promise.all([
    prisma.investorWithdrawal.findMany({where:{userId:user.id},orderBy:[{createdAt:"desc"},{id:"desc"}],skip:(wPage-1)*PAGE_SIZE,take:PAGE_SIZE}),
    prisma.withdrawalDeallocation.findMany({where:{userId:user.id},orderBy:[{createdAt:"desc"},{id:"desc"}],skip:(dPage-1)*PAGE_SIZE,take:PAGE_SIZE,
      include:{withdrawal:{select:{status:true}}}}),
  ]);
  const enabled=process.env.BLOCKRADAR_WITHDRAWALS_ENABLED==="true";
  const allocated=portfolio?.allocatedUsdcMicros??0n;
  const unallocated=portfolio?.unallocatedUsdcMicros??0n;
  const pending=portfolio?.pendingWithdrawalsUsdcMicros??0n;
  const available=allocated+unallocated>pending?allocated+unallocated-pending:0n;
  const heading="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]";
  const cell="whitespace-nowrap px-5 py-4 text-sm text-[#334155]";
  return <Shell><div className="mx-auto max-w-5xl">
    <PageIntro eyebrow="Investor portal / Capital" title="Withdrawals" description="Request Solana USDC payouts and track their status."/>
    <div className="grid gap-4 md:grid-cols-3">
      <BalanceTile label="Allocated capital" value={allocated} icon={ShieldCheck} detail="May require deallocation"/>
      <BalanceTile label="Unallocated capital" value={unallocated} icon={ArrowUpFromLine} detail="Not currently allocated"/>
      <BalanceTile label="Pending withdrawals" value={pending} icon={Clock3} detail="Reserved for withdrawal requests"/>
    </div>
    <section className="mt-6 rounded-2xl border border-[#E3E8EE] bg-white p-6">
      <div className="flex items-center gap-3"><ShieldCheck size={20} className="text-[#635BFF]"/><h2 className="text-xl font-semibold">Request a withdrawal</h2></div>
      {enabled?<WithdrawalForm balanceMicros={available.toString()} unallocatedMicros={unallocated.toString()} pendingMicros={pending.toString()}/>:<p className="mt-4 text-sm text-[#425466]">Withdrawal requests are not enabled yet.</p>}
    </section>

    <section className="mt-6 overflow-hidden rounded-2xl border border-[#E3E8EE] bg-white">
      <div className="px-5 pt-6 sm:px-6"><h2 className="text-xl font-semibold">Withdrawals</h2>
        <p className="mt-2 text-sm text-[#64748B]">Your withdrawal requests and payout progress.</p></div>
      {records.length===0?<p className="px-5 py-8 text-sm text-[#64748B]">No withdrawals yet.</p>:
      <div className="mt-5 w-full overflow-x-auto" role="region" aria-label="Withdrawals table" tabIndex={0}>
        <table className="w-full min-w-[950px] border-collapse text-left">
          <thead className="border-y border-[#E9EDF3] bg-[#F8FAFC]"><tr>
            <th className={heading}>Gross</th><th className={heading}>Fee</th>
            <th className={heading}>Recipient receives</th><th className={heading}>Recipient wallet</th>
            <th className={heading}>Transaction</th><th className={heading}>Status</th><th className={heading}>Requested</th>
          </tr></thead>
          <tbody className="divide-y divide-[#EDF0F5]">{records.map(record=><tr key={record.id} className="hover:bg-[#FAFBFF]">
            <td className={cell+" font-semibold"}>{formatUsdc(record.grossUsdcMicros)}</td>
            <td className={cell}>{formatUsdc(record.feeUsdcMicros)}</td>
            <td className={cell+" font-semibold"}>{formatUsdc(record.amountUsdcMicros)}</td>
            <td className={cell+" font-mono text-xs"} title={record.destinationAddress}>{record.destinationAddress}</td>
            <td className={cell+" font-mono text-xs"} title={record.transactionHash??""}>{record.transactionHash??"—"}</td>
            <td className={cell}><span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-semibold">{record.status}</span></td>
            <td className={cell}>{date(record.createdAt)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <Pager page={wPage} pages={withdrawalPages} total={withdrawalCount} keyName="withdrawalsPage" other={dPage}/>
    </section>

    <section className="mt-6 overflow-hidden rounded-2xl border border-[#E3E8EE] bg-white">
      <div className="px-5 pt-6 sm:px-6"><h2 className="text-xl font-semibold">Deallocations</h2>
        <p className="mt-2 text-sm text-[#64748B]">Track funds being made available from allocated capital. Deallocation and payout statuses are independent.</p></div>
      {deallocations.length===0?<p className="px-5 py-8 text-sm text-[#64748B]">No deallocation requests yet.</p>:
      <div className="mt-5 w-full overflow-x-auto" role="region" aria-label="Deallocations table" tabIndex={0}>
        <table className="w-full min-w-[850px] border-collapse text-left">
          <thead className="border-y border-[#E9EDF3] bg-[#F8FAFC]"><tr>
            <th className={heading}>Requested</th><th className={heading}>Amount</th><th className={heading}>Status</th>
            <th className={heading}>Withdrawal ID</th><th className={heading}>Withdrawal status</th><th className={heading}>Completed</th>
          </tr></thead>
          <tbody className="divide-y divide-[#EDF0F5]">{deallocations.map(item=><tr key={item.id} className="hover:bg-[#FAFBFF]">
            <td className={cell}>{date(item.createdAt)}</td>
            <td className={cell+" font-semibold"}>{formatUsdc(item.amountUsdcMicros)}</td>
            <td className={cell}><span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-semibold">{item.status}</span></td>
            <td className={cell+" font-mono text-xs"}>{item.withdrawalId}</td>
            <td className={cell}>{item.withdrawal.status}</td>
            <td className={cell}>{date(item.completedAt)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <Pager page={dPage} pages={deallocationPages} total={deallocationCount} keyName="deallocationsPage" other={wPage}/>
    </section>
    <p className="mt-6 text-sm text-[#425466]">Withdrawals may include allocated USDC, which may require additional processing before payout. <Link href="/wallet" className="underline">Return to wallet</Link>.</p>
  </div></Shell>;
}
