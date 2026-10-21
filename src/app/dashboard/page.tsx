import { LineChart, FileBarChart2 } from "lucide-react";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
export const dynamic = "force-dynamic";
export default async function Dashboard(){
 const session = await requireUser();
 const positions=await prisma.investorPosition.findMany({where:{userId:session.id}});
 const allocated=positions.reduce((total,p)=>total+p.principalUsdcMicros,0n);
 const unallocated=session.unallocated;
 const realized=positions.reduce((total,p)=>total+p.realizedPnlUsdcMicros,0n);
 const equity=allocated+unallocated;
 const capital=allocated+unallocated;
 const allocatedPct=capital>0n?Number(allocated*10000n/capital)/100:0;
 const unallocatedPct=capital>0n?100-allocatedPct:0;
 const periods=[{label:"Daily",window:"24 hours"},{label:"Weekly",window:"7 days"},{label:"Monthly",window:"30 days"}];
 return <Shell><div className="mx-auto max-w-7xl space-y-6">
  <header><p className="text-sm leading-6 text-[#64748B]">Welcome back{session.name?", "+session.name:""}. Here's how your investment is performing.</p></header>
  <section aria-label="Investment overview" className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
   <article className="rounded-[24px] border border-[#E2E8F4] bg-gradient-to-br from-[#EEF2FF] via-[#F7F9FF] to-white p-6 sm:p-8">
    <p className="text-sm font-medium text-[#52647B]">Portfolio value</p>
    <p className="mt-5 break-words text-[clamp(2.4rem,4.6vw,4.5rem)] font-semibold leading-none tracking-tight tabular-nums text-[#11263E]">{formatUsdc(equity)}</p>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[#DCE4F0] pt-5">
     <span className="text-sm text-[#64748B]">Cumulative realized P&amp;L</span>
     <span className="text-lg font-semibold tabular-nums text-[#11263E]">{realized>0n?"+":""}{formatUsdc(realized)}</span>
    </div>
    <p className="mt-4 text-xs leading-5 text-[#64748B]">Ledger-based portfolio estimate. Realized P&amp;L reflects recorded earnings, not a period return or live market valuation.</p>
   </article>
   <article className="rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
    <h2 className="text-base font-semibold text-[#11263E]">Capital allocation</h2>
    <p className="mt-1 text-xs text-[#64748B]">Where your recorded capital is positioned.</p>
    <div role="img" aria-label={capital>0n?`Allocated ${allocatedPct.toFixed(1)} percent; unallocated ${unallocatedPct.toFixed(1)} percent`:"No allocated or unallocated capital"} className="mt-7 flex h-3 overflow-hidden rounded-full bg-[#EDF0F7]">
     {capital>0n&&<><div className="h-full bg-[#635BFF]" style={{width:allocatedPct+"%"}}/><div className="h-full bg-[#C7D2FE]" style={{width:unallocatedPct+"%"}}/></>}
    </div>
    <dl className="mt-7 grid grid-cols-2 gap-4">
     <div className="min-w-0"><dt className="flex items-center gap-2 text-xs text-[#64748B]"><span className="h-2 w-2 rounded-full bg-[#635BFF]"/>Allocated</dt><dd className="mt-2 break-words text-lg font-semibold tabular-nums text-[#11263E] sm:text-xl">{formatUsdc(allocated)}</dd><p className="mt-1 text-xs text-[#94A3B8]">{allocatedPct.toFixed(1)}% of capital</p></div>
     <div className="min-w-0"><dt className="flex items-center gap-2 text-xs text-[#64748B]"><span className="h-2 w-2 rounded-full bg-[#C7D2FE]"/>Unallocated</dt><dd className="mt-2 break-words text-lg font-semibold tabular-nums text-[#11263E] sm:text-xl">{formatUsdc(unallocated)}</dd><p className="mt-1 text-xs text-[#94A3B8]">{unallocatedPct.toFixed(1)}% of capital</p></div>
    </dl>
    <p className="mt-6 border-t border-[#EDF0F5] pt-4 text-xs leading-5 text-[#94A3B8]">Percentages use allocated + unallocated capital, excluding realized P&amp;L.</p>
   </article>
  </section>
  <section aria-labelledby="trend-heading" className="rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
   <div className="flex flex-wrap items-start justify-between gap-4">
    <div><h2 id="trend-heading" className="text-lg font-semibold text-[#11263E]">Portfolio value over time</h2><p className="mt-1 text-sm text-[#64748B]">Historical performance and growth.</p></div>
    <p className="rounded-full bg-[#F1F3F9] px-3 py-1.5 text-xs font-medium text-[#7B8799]">History unavailable</p>
   </div>
   <div className="mt-6 flex min-h-[255px] flex-col items-center justify-center rounded-xl bg-[#F8FAFD] px-6 py-9 text-center">
    <LineChart size={28} strokeWidth={1.5} className="text-[#8C85F5]" aria-hidden="true"/>
    <p className="mt-4 text-sm font-semibold text-[#11263E]">Building your performance history</p>
    <p className="mt-2 max-w-sm text-xs leading-5 text-[#64748B]">A verified historical valuation series is needed before charting investment growth. We won't draw an artificial return curve.</p>
   </div>
  </section>
  <section aria-labelledby="period-heading">
   <h2 id="period-heading" className="mb-3 text-lg font-semibold text-[#11263E]">Period returns</h2>
   <div className="grid grid-cols-3 gap-3">{periods.map(period=><article key={period.label} className="rounded-xl border border-[#E3E8EE] bg-white px-4 py-4">
    <p className="text-xs font-medium text-[#64748B]">{period.label}</p><p className="mt-2 text-xl font-semibold text-[#94A3B8]">—</p><p className="mt-1 text-xs text-[#94A3B8]">{period.window}</p>
   </article>)}</div>
   <p className="mt-3 text-xs leading-5 text-[#64748B]">Period returns are not yet supported by verified investor-level valuation history.</p>
  </section>
  <section aria-labelledby="report-heading" className="rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
   <div className="flex items-center gap-2"><FileBarChart2 size={18} className="text-[#635BFF]"/><h2 id="report-heading" className="text-lg font-semibold text-[#11263E]">Performance report</h2></div>
   <p className="mt-2 text-sm text-[#64748B]">A summary of verified portfolio accounting, without speculative returns.</p>
   <dl className="mt-5 divide-y divide-[#EDF0F5]">
    <div className="flex flex-wrap items-center justify-between gap-3 py-4"><dt className="text-sm text-[#64748B]">Recorded capital</dt><dd className="text-sm font-semibold tabular-nums text-[#11263E]">{formatUsdc(capital)}</dd></div>
    <div className="flex flex-wrap items-center justify-between gap-3 py-4"><dt className="text-sm text-[#64748B]">Cumulative realized P&amp;L</dt><dd className="text-sm font-semibold tabular-nums text-[#11263E]">{realized>0n?"+":""}{formatUsdc(realized)}</dd></div>
    <div className="flex flex-wrap items-center justify-between gap-3 py-4"><dt className="text-sm text-[#64748B]">Unrealized P&amp;L</dt><dd className="text-sm text-[#94A3B8]">Not available</dd></div>
    <div className="flex flex-wrap items-center justify-between gap-3 py-4"><dt className="text-sm text-[#64748B]">Total investment return</dt><dd className="text-sm text-[#94A3B8]">Not available</dd></div>
   </dl>
   <p className="mt-4 text-xs leading-5 text-[#94A3B8]">Investor-specific unrealized P&amp;L and return calculations require reconciled investment history. Deposits and withdrawals are managed separately in Wallet.</p>
  </section>
 </div></Shell>;
}
