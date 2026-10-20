import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
import { WithdrawalForm } from "@/components/withdrawal-actions";

const PAGE_SIZE = 10;
function pageNumber(raw:string|undefined){const n=Number(raw??"1");return Number.isSafeInteger(n)&&n>0?Math.min(n,100000):1;}
function date(value:Date|null){return value?value.toLocaleString("en-US",{timeZone:"UTC",dateStyle:"medium",timeStyle:"short"})+" UTC":"—";}
function Pager({page,pages,total,depositsPage}:{page:number;pages:number;total:number;depositsPage:number}){
 const href=(n:number)=>`/wallet?depositsPage=${depositsPage}&withdrawalsPage=${n}#withdraw-usdc`;
 const cls="rounded-lg border border-[#DEE5EE] px-3 py-2 text-xs font-semibold";
 return <div className="flex items-center justify-between gap-3 border-t border-[#EDF0F5] px-4 py-4"><p className="text-xs text-[#64748B]">{total} results</p><nav aria-label="Withdrawals pages" className="flex gap-3">{page>1?<Link href={href(page-1)} className={cls}>Previous</Link>:null}<span>Page {page} of {pages}</span>{page<pages?<Link href={href(page+1)} className={cls}>Next</Link>:null}</nav></div>;
}
export async function WalletWithdrawals({userId,unallocated,pending,pendingAllocations,withdrawalsPage,depositsPage}:{userId:string;unallocated:bigint;pending:bigint;pendingAllocations:bigint;withdrawalsPage?:string;depositsPage:number}){
 const withdrawalCount=await prisma.investorWithdrawal.count({where:{userId}});
 const withdrawalPages=Math.max(1,Math.ceil(withdrawalCount/PAGE_SIZE));
 const wPage=Math.min(pageNumber(withdrawalsPage),withdrawalPages);
 const records=await prisma.investorWithdrawal.findMany({where:{userId},orderBy:[{createdAt:"desc"},{id:"desc"}],skip:(wPage-1)*PAGE_SIZE,take:PAGE_SIZE});
 const available=unallocated>pending+pendingAllocations?unallocated-pending-pendingAllocations:0n;
 const enabled=process.env.BLOCKRADAR_WITHDRAWALS_ENABLED==="true";
 const heading="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]";
 const cell="whitespace-nowrap px-5 py-4 text-sm text-[#334155]";
 return <section id="withdraw-usdc" aria-label="Withdraw USDC" className="mt-8 scroll-mt-6 rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
  <h2 className="text-2xl font-semibold tracking-tight">Withdraw USDC</h2>
  <p className="mt-2 text-sm text-[#425466]">Send USDC to your Solana wallet and track withdrawal progress.</p>
  {enabled?<WithdrawalForm balanceMicros={available.toString()} unallocatedMicros={unallocated.toString()} pendingMicros={pending.toString()}/>:<p className="mt-5 text-sm text-[#425466]">Withdrawal requests are not enabled yet.</p>}
    <section className="mt-10 border-t border-[#E3E8EE] pt-7">
      <div className="px-0"><h2 className="text-xl font-semibold">Withdrawals</h2>
        <p className="mt-2 text-sm text-[#64748B]">Your withdrawal requests and payout progress.</p></div>
      {records.length===0?<p className="py-6 text-sm text-[#64748B]">No withdrawals yet.</p>:
      <div className="mt-5 w-full overflow-x-auto rounded-xl border border-[#E7EDF4]" role="region" aria-label="Withdrawals table" tabIndex={0}>
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
      <Pager page={wPage} pages={withdrawalPages} total={withdrawalCount} depositsPage={depositsPage}/>
    </section>
 </section>;
}
