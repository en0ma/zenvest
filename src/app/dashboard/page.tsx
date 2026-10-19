import Link from "next/link";
import { ArrowUpRight, BarChart3, TrendingUp, LineChart, FileBarChart2 } from "lucide-react";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
export const dynamic = "force-dynamic";
export default async function Dashboard(){
 const session = await requireUser();
 const portfolio = await prisma.investorPortfolio.findUnique({where:{userId:session.id}});
 const allocated=portfolio?.allocatedUsdcMicros??0n;
 const unallocated=portfolio?.unallocatedUsdcMicros??0n;
 const realized=portfolio?.realizedPnlUsdcMicros??0n;
 const equity=allocated+unallocated+realized;
 const periods=[{label:"Daily",window:"24 hours"},{label:"Weekly",window:"7 days"},{label:"Monthly",window:"30 days"}];
 return <Shell><div className="mx-auto max-w-7xl space-y-7">
  <header>
   <p className="text-sm leading-6 text-[#64748B]">Welcome back{session.name?", "+session.name:""}. Explore how your portfolio is performing and follow your investment progress over time.</p>
  </header>
  <section aria-label="Portfolio summary">
   <article className="rounded-[24px] border border-[#E2E8F4] bg-gradient-to-br from-[#EEF2FF] via-[#F7F9FF] to-white p-7 sm:p-9">
    <p className="text-sm font-semibold text-[#52647B]">Portfolio value</p>
    <p className="mt-5 break-words text-[clamp(2.4rem,5vw,4.6rem)] font-semibold leading-none tracking-tight tabular-nums text-[#11263E]">{formatUsdc(equity)}</p>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-[#DCE4F0] pt-5">
     <div className="flex items-center gap-2 text-sm font-medium text-[#64748B]"><TrendingUp size={16} className="text-[#635BFF]" aria-hidden="true"/>Cumulative realized P&amp;L</div>
     <p className="text-lg font-semibold tracking-tight tabular-nums text-[#11263E] sm:text-xl">{realized>0n?"+":""}{formatUsdc(realized)}</p>
    </div>
    <p className="mt-4 text-xs leading-5 text-[#64748B]">Ledger-based portfolio estimate, not a live market valuation. Realized P&amp;L is cumulative, not a period return.</p>
   </article>
  </section>
  <section aria-labelledby="trend-heading" className="rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div><h2 id="trend-heading" className="text-xl font-semibold text-[#11263E]">Performance over time</h2><p className="mt-1 text-sm text-[#64748B]">Historical portfolio value and investment returns.</p></div>
    <div className="flex rounded-xl border border-[#E3E8EE] bg-[#F8FAFC] p-1 text-xs font-medium text-[#8995A7]" aria-label="Available reporting periods">
     <span className="rounded-lg px-3 py-2">1W</span><span className="rounded-lg px-3 py-2">1M</span><span className="rounded-lg px-3 py-2">3M</span><span className="rounded-lg px-3 py-2">1Y</span>
    </div>
   </div>
   <div className="mt-7 flex min-h-[235px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#DFE5EF] bg-[#FAFBFD] px-6 py-10 text-center sm:min-h-[290px]">
    <LineChart size={29} strokeWidth={1.5} className="text-[#635BFF]" aria-hidden="true"/>
    <p className="mt-4 text-base font-semibold text-[#11263E]">Your performance chart is being prepared</p>
    <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">Verified historical portfolio snapshots are needed before a performance chart or return percentages can be shown.</p>
   </div>
   <p className="mt-4 text-xs leading-5 text-[#94A3B8]">Chart time ranges will become available when historical valuations are recorded. No illustrative gains are shown.</p>
  </section>
  <section aria-labelledby="period-heading">
   <div className="mb-4"><h2 id="period-heading" className="text-xl font-semibold text-[#11263E]">Period returns</h2><p className="mt-1 text-sm text-[#64748B]">A quick look at daily, weekly, and monthly results.</p></div>
   <div className="grid grid-cols-3 gap-3">{periods.map(period=><article key={period.label} className="rounded-xl border border-[#E3E8EE] bg-white px-4 py-4 sm:px-5">
    <p className="text-xs font-medium text-[#64748B]">{period.label}</p><p className="mt-2 text-xl font-semibold text-[#94A3B8]">—</p>
    <p className="mt-1 text-xs text-[#94A3B8]">{period.window}</p>
   </article>)}</div>
   <p className="mt-3 text-xs leading-5 text-[#64748B]">Period returns are unavailable until dated investor-level P&amp;L and valuation history is recorded.</p>
  </section>
  <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
   <section aria-labelledby="report-heading" className="min-w-0 rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
    <div className="flex items-center gap-2"><FileBarChart2 size={19} className="text-[#635BFF]"/><h2 id="report-heading" className="text-lg font-semibold text-[#11263E]">Performance report</h2></div>
    <p className="mt-2 text-sm text-[#64748B]">A clear summary of your recorded investment results.</p>
    <dl className="mt-6 divide-y divide-[#EDF0F5]">
     <div className="flex flex-wrap items-center justify-between gap-3 py-4"><dt className="text-sm text-[#64748B]">Cumulative realized P&amp;L</dt><dd className="text-sm font-semibold tabular-nums text-[#11263E]">{realized>0n?"+":""}{formatUsdc(realized)}</dd></div>
     <div className="flex flex-wrap items-center justify-between gap-3 py-4"><dt className="text-sm text-[#64748B]">Unrealized P&amp;L</dt><dd className="text-sm text-[#94A3B8]">Not available</dd></div>
     <div className="flex flex-wrap items-center justify-between gap-3 py-4"><dt className="text-sm text-[#64748B]">Net investment return</dt><dd className="text-sm text-[#94A3B8]">Not available</dd></div>
     <div className="flex flex-wrap items-center justify-between gap-3 py-4"><dt className="text-sm text-[#64748B]">Historical comparison</dt><dd className="text-sm text-[#94A3B8]">Not available</dd></div>
    </dl>
    <p className="mt-5 text-xs leading-5 text-[#8995A7]">Recorded P&amp;L is cumulative. Investor-level return calculations and report exports require validated historical records.</p>
   </section>
   <div className="space-y-6">
    <section aria-labelledby="projection-heading" className="rounded-[24px] border border-[#E3E8EE] bg-white p-6">
     <div className="flex items-center gap-2"><BarChart3 size={18} className="text-[#635BFF]"/><h2 id="projection-heading" className="text-lg font-semibold text-[#11263E]">Projections</h2></div>
     <p className="mt-6 text-xl font-semibold text-[#11263E]">Not available yet</p>
     <p className="mt-3 text-sm leading-6 text-[#64748B]">Reliable projections require verified historical investor returns and a defined model. Future profit cannot be estimated from current balances alone.</p>
    </section>
    <section className="rounded-[24px] bg-[#F6F9FC] p-6"><h2 className="text-lg font-semibold text-[#11263E]">Reporting notes</h2>
     <p className="mt-3 text-sm leading-6 text-[#64748B]">Growth comparisons and period return percentages will appear once historical account valuations and investor-level P&amp;L are supported.</p>
     <Link href="/bot" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#635BFF]">Strategy details <ArrowUpRight size={15}/></Link>
    </section>
   </div>
  </div>
 </div></Shell>;
}
