import Link from "next/link";
import { ArrowUpRight, BarChart3, TrendingUp } from "lucide-react";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
export const dynamic = "force-dynamic";
export default async function Dashboard(){
 const session = await requireUser();
 const portfolio = await prisma.investorPortfolio.findUnique({where:{userId:session.id}});
 const now=new Date();
 const activity=portfolio?await prisma.investorActivity.findMany({where:{portfolioId:portfolio.id,occurredAt:{gte:new Date(now.getTime()-30*86400000)}},select:{type:true,occurredAt:true},orderBy:{occurredAt:"desc"},take:500}):[];
 const daily=activity.filter(a=>a.occurredAt>=new Date(now.getTime()-86400000));
 const weekly=activity.filter(a=>a.occurredAt>=new Date(now.getTime()-7*86400000));
 const allocated=portfolio?.allocatedUsdcMicros??0n;
 const unallocated=portfolio?.unallocatedUsdcMicros??0n;
 const realized=portfolio?.realizedPnlUsdcMicros??0n;
 const equity=allocated+unallocated+realized;
 const periods=[{label:"Daily",window:"Past 24 hours",items:daily},{label:"Weekly",window:"Past 7 days",items:weekly},{label:"Monthly",window:"Past 30 days",items:activity}];
 return <Shell><div className="mx-auto max-w-7xl space-y-7">
  <header>
   <p className="text-sm text-[#64748B]">Welcome back{session.name?", "+session.name:""}.</p>
   <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#11263E] sm:text-4xl">Performance overview</h1>
   <p className="mt-2 text-sm text-[#64748B]">Your portfolio results, reporting periods, and forward-looking insights.</p>
  </header>
  <section aria-label="Portfolio summary" className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
   <article className="rounded-[24px] border border-[#E2E8F4] bg-gradient-to-br from-[#EEF2FF] via-[#F7F9FF] to-white p-7 sm:p-9">
    <p className="text-sm font-semibold text-[#52647B]">Portfolio value</p>
    <p className="mt-5 break-words text-[clamp(2.4rem,5vw,4.6rem)] font-semibold leading-none tracking-tight tabular-nums text-[#11263E]">{formatUsdc(equity)}</p>
    <p className="mt-8 border-t border-[#DCE4F0] pt-4 text-xs leading-5 text-[#64748B]">Ledger-based estimate: allocated + unallocated capital + recorded realized P&amp;L. Not a live market valuation.</p>
   </article>
   <article className="rounded-[24px] border border-[#E3E8EE] bg-white p-7 sm:p-9">
    <div className="flex items-center gap-2 text-sm font-semibold text-[#52647B]"><TrendingUp size={17} className="text-[#635BFF]"/>Cumulative realized P&amp;L</div>
    <p className="mt-5 break-words text-3xl font-semibold tracking-tight tabular-nums text-[#11263E] sm:text-4xl">{realized>0n?"+":""}{formatUsdc(realized)}</p>
    <p className="mt-5 text-sm leading-6 text-[#64748B]">Recorded investor profit and loss to date. This is not a return for a particular reporting period.</p>
   </article>
  </section>
  <section aria-labelledby="period-heading">
   <div className="mb-4"><h2 id="period-heading" className="text-xl font-semibold text-[#11263E]">Performance by period</h2><p className="mt-1 text-sm text-[#64748B]">Daily, weekly, and monthly reporting windows.</p></div>
   <div className="grid gap-4 sm:grid-cols-3">{periods.map(period=><article key={period.label} className="rounded-2xl border border-[#E3E8EE] bg-white p-6">
    <p className="text-sm font-semibold text-[#52647B]">{period.label}</p><p className="mt-4 text-3xl font-semibold text-[#11263E]">— <span className="text-sm font-normal text-[#64748B]">P&amp;L</span></p>
    <p className="mt-3 text-sm text-[#64748B]">{period.items.length} recorded {period.items.length===1?"event":"events"}</p>
    <p className="mt-1 text-xs text-[#94A3B8]">{period.window}</p>
   </article>)}</div>
   <p className="mt-3 text-xs leading-5 text-[#64748B]">Period P&amp;L is not yet available: dated investor-level profit snapshots are not recorded. Activity counts are not investment returns.{activity.length===500?" Monthly activity is capped at the latest 500 events.":""}</p>
  </section>
  <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
   <section aria-labelledby="report-heading" className="min-w-0 overflow-hidden rounded-[24px] border border-[#E3E8EE] bg-white">
    <div className="px-6 py-6"><h2 id="report-heading" className="text-lg font-semibold text-[#11263E]">Activity report</h2><p className="mt-1 text-sm text-[#64748B]">Account events recorded in each reporting period.</p></div>
    <div role="region" aria-label="Activity report table" tabIndex={0} className="overflow-x-auto"><table className="w-full min-w-[520px] border-collapse text-left text-sm">
     <thead className="border-y border-[#E9EDF3] bg-[#F8FAFC] text-xs font-semibold uppercase text-[#64748B]"><tr><th className="px-6 py-3">Period</th><th className="px-6 py-3 text-right">Events</th><th className="px-6 py-3">Latest activity</th></tr></thead>
     <tbody className="divide-y divide-[#EDF0F5]">{periods.map(period=><tr key={period.label}><th scope="row" className="whitespace-nowrap px-6 py-4 font-semibold text-[#11263E]">{period.window}</th><td className="px-6 py-4 text-right tabular-nums">{period.items.length}</td><td className="px-6 py-4 text-[#64748B]">{period.items[0]?period.items[0].type.replaceAll("_"," ").toLowerCase():"No events"}</td></tr>)}</tbody>
    </table></div>
    <p className="px-6 py-5 text-xs leading-5 text-[#8995A7]">Operational reporting only, not a return statement. Detailed deposits and withdrawals remain available in Wallet.</p>
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
