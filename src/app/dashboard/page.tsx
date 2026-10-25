import { FileBarChart2 } from "lucide-react";
import Link from "next/link";
import {PortfolioValueChart} from "@/components/portfolio-value-chart";
import {reconstructPortfolioPerformance, type PortfolioEvent} from "@/lib/portfolio-performance";
import {PnlPerformanceChart} from "@/components/pnl-performance-chart";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
export const dynamic = "force-dynamic";
const TABLE_PAGE_SIZE=10;
function pageParam(value:string|undefined){const n=Number(value??"1");return Number.isSafeInteger(n)&&n>0?Math.min(n,100000):1;}
function TablePager({page,pages,name,otherPage,otherName}:{page:number;pages:number;name:string;otherPage:number;otherName:string}){
 const link=(next:number)=>`/dashboard?${name}=${next}&${otherName}=${otherPage}`;
 return <nav aria-label={`${name==="positionsPage"?"Position performance":"Settled trade history"} pagination`} className="mt-4 flex items-center justify-between gap-3 border-t border-[#EDF0F5] pt-4 text-sm">
  <span className="text-[#64748B]">Page {page} of {pages}</span><div className="flex items-center gap-2">
  {page>1?<Link className="rounded-lg border border-[#DCE3EC] px-3 py-2 font-medium" href={link(page-1)}>Previous</Link>:<span className="rounded-lg border border-[#DCE3EC] px-3 py-2 text-[#94A3B8]" aria-disabled="true">Previous</span>}
  {page<pages?<Link className="rounded-lg border border-[#DCE3EC] px-3 py-2 font-medium" href={link(page+1)}>Next</Link>:<span className="rounded-lg border border-[#DCE3EC] px-3 py-2 text-[#94A3B8]" aria-disabled="true">Next</span>}
  </div></nav>;
}
export default async function Dashboard({searchParams}:{searchParams:Promise<{positionsPage?:string;tradesPage?:string}>}){
 const params=await searchParams;
 const session = await requireUser();
 const account=await prisma.user.findUniqueOrThrow({where:{id:session.id},select:{unallocated:true}});
 const positions=await prisma.investorPosition.findMany({where:{userId:session.id},include:{strategy:{select:{name:true}}},orderBy:{createdAt:"desc"}});
 const allocated=positions.reduce((total,p)=>total+p.allocatedUsdcMicros,0n);
 const unallocated=account.unallocated;
 const settled=await prisma.positionTradePnl.findMany({where:{userId:session.id,status:"SETTLED"},orderBy:[{settledAt:"asc"},{id:"asc"}],include:{strategyTrade:{select:{marketTradeName:true}}}});
 const [deposits,withdrawals,withdrawalReservations,allocationReservations]=await Promise.all([
  prisma.blockchainDeposit.findMany({where:{wallet:{userId:session.id},status:"CONFIRMED",creditedAt:{not:null}},
   select:{id:true,creditedAt:true,amountUsdcMicros:true}}),
  prisma.withdrawal.findMany({where:{userId:session.id,status:"COMPLETED",completedAt:{not:null}},
   select:{id:true,completedAt:true,grossUsdcMicros:true}}),
  prisma.withdrawal.aggregate({where:{userId:session.id,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},_sum:{grossUsdcMicros:true}}),
  prisma.positionAllocation.aggregate({where:{userId:session.id,kind:"ALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","REVIEW"]}},_sum:{amountUsdcMicros:true}}),
 ]);
 const financialEvents:PortfolioEvent[]=[
  ...deposits.filter(d=>d.creditedAt).map(d=>({id:"deposit:"+d.id,at:d.creditedAt!,kind:"DEPOSIT" as const,
   amountMicros:d.amountUsdcMicros})),
  ...withdrawals.filter(w=>w.completedAt).map(w=>({id:"withdrawal:"+w.id,at:w.completedAt!,kind:"WITHDRAWAL" as const,
   amountMicros:-w.grossUsdcMicros})),
  ...settled.filter(p=>p.settledAt).map(p=>({id:"pnl:"+p.id,at:p.settledAt!,kind:"PNL" as const,
   amountMicros:p.netPnlUsdcMicros??0n})),
 ];
 const realized=settled.reduce((total,p)=>total+(p.netPnlUsdcMicros??0n),0n);
 const winning=settled.filter(p=>(p.netPnlUsdcMicros??0n)>0n).length;
 const losing=settled.filter(p=>(p.netPnlUsdcMicros??0n)<0n).length;
 const equity=allocated+unallocated;
 const capital=allocated+unallocated;
 const reserved=(withdrawalReservations._sum.grossUsdcMicros??0n)+(allocationReservations._sum.amountUsdcMicros??0n);
 const historical=reconstructPortfolioPerformance(capital,financialEvents);
 const allocatedPct=capital>0n?Number(allocated*10000n/capital)/100:0;
 const unallocatedPct=capital>0n?100-allocatedPct:0;
 const now=Date.now();
 const sumSince=(days:number)=>settled.filter(x=>x.settledAt&&x.settledAt.getTime()>=now-days*86400000).reduce((n,x)=>n+(x.netPnlUsdcMicros??0n),0n);
 const periods=[{label:"24-hour P&L",value:sumSince(1),window:"Past 24 hours"},
  {label:"7-day P&L",value:sumSince(7),window:"Past 7 days"},
  {label:"30-day P&L",value:sumSince(30),window:"Past 30 days"}];
 
 const best=settled.reduce<bigint|null>((v,p)=>v===null||(p.netPnlUsdcMicros??0n)>v?(p.netPnlUsdcMicros??0n):v,null);
 const worst=settled.reduce<bigint|null>((v,p)=>v===null||(p.netPnlUsdcMicros??0n)<v?(p.netPnlUsdcMicros??0n):v,null);
 const positionStats=await prisma.positionTradePnl.groupBy({by:["positionId"],where:{userId:session.id,status:"SETTLED"},
  _sum:{netPnlUsdcMicros:true,platformFeeUsdcMicros:true},_count:{_all:true}});
 const statsByPosition=new Map(positionStats.map(x=>[x.positionId,x]));
 const positionPages=Math.max(1,Math.ceil(positions.length/TABLE_PAGE_SIZE));
 const tradePages=Math.max(1,Math.ceil(settled.length/TABLE_PAGE_SIZE));
 const positionsPage=Math.min(pageParam(params.positionsPage),positionPages);
 const tradesPage=Math.min(pageParam(params.tradesPage),tradePages);
 const pagedPositions=positions.slice((positionsPage-1)*TABLE_PAGE_SIZE,positionsPage*TABLE_PAGE_SIZE);
 const pagedTrades=settled.slice().reverse().slice((tradesPage-1)*TABLE_PAGE_SIZE,tradesPage*TABLE_PAGE_SIZE);
 return <Shell><div className="mx-auto max-w-7xl space-y-6">
  <header><p className="text-sm leading-6 text-[#64748B]">Welcome back{session.name?", "+session.name:""}. Here's how your investment is performing.</p></header>
  <section aria-label="Investment overview" className="block">
   <article className="rounded-[24px] border border-[#E2E8F4] bg-gradient-to-br from-[#EEF2FF] via-[#F7F9FF] to-white p-6 sm:p-8">
    <p className="text-sm font-medium text-[#52647B]">Portfolio value</p>
    <p className="mt-5 break-words text-[clamp(2.4rem,4.6vw,4.5rem)] font-semibold leading-none tracking-tight tabular-nums text-[#11263E]">{formatUsdc(equity)}</p>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[#DCE4F0] pt-5">
     <span className="text-sm text-[#64748B]">Cumulative realized P&amp;L</span>
     <span className="text-lg font-semibold tabular-nums text-[#11263E]">{realized>0n?"+":""}{formatUsdc(realized)}</span>
    </div>
    
    <div className="mt-7 border-t border-[#DCE4F0] pt-6">
    <h2 className="text-base font-semibold text-[#11263E]">Capital allocation</h2>
    
    <div role="img" aria-label={capital>0n?`Allocated ${allocatedPct.toFixed(1)} percent; unallocated ${unallocatedPct.toFixed(1)} percent`:"No allocated or unallocated capital"} className="mt-7 flex h-3 overflow-hidden rounded-full bg-[#EDF0F7]">
     {capital>0n&&<><div className="h-full bg-[#635BFF]" style={{width:allocatedPct+"%"}}/><div className="h-full bg-[#C7D2FE]" style={{width:unallocatedPct+"%"}}/></>}
    </div>
    <dl className="mt-7 grid grid-cols-2 gap-4">
     <div className="min-w-0"><dt className="flex items-center gap-2 text-xs text-[#64748B]"><span className="h-2 w-2 rounded-full bg-[#635BFF]"/>Allocated</dt><dd className="mt-2 break-words text-lg font-semibold tabular-nums text-[#11263E] sm:text-xl">{formatUsdc(allocated)}</dd><p className="mt-1 text-xs text-[#94A3B8]">{allocatedPct.toFixed(1)}% of capital</p></div>
     <div className="min-w-0"><dt className="flex items-center gap-2 text-xs text-[#64748B]"><span className="h-2 w-2 rounded-full bg-[#C7D2FE]"/>Unallocated</dt><dd className="mt-2 break-words text-lg font-semibold tabular-nums text-[#11263E] sm:text-xl">{formatUsdc(unallocated)}</dd><p className="mt-1 text-xs text-[#94A3B8]">{unallocatedPct.toFixed(1)}% of capital</p></div>
    </dl>
    <p className="mt-6 border-t border-[#EDF0F5] pt-4 text-xs leading-5 text-[#64748B]">Reserved: {formatUsdc(reserved)} · Pending withdrawal and allocation requests reduce spendable unallocated funds.</p>
    
    </div>
   </article>
  </section>
  {historical.completeHistory?<PortfolioValueChart points={historical.points}/>:<section className="rounded-[24px] border border-[#E3E8EE] bg-white p-6"><h2 className="text-lg font-semibold">Historical portfolio value</h2><p className="mt-3 text-sm text-[#64748B]">Historical balances are unavailable until existing deposits, withdrawals, adjustments and trading entries reconcile with the current portfolio balance.</p></section>}
  <section aria-label="Investment return calculations" className="rounded-2xl border border-[#E3E8EE] bg-white p-5 sm:p-6">
   <h2 className="text-lg font-semibold text-[#11263E]">Investment returns</h2>
   <div className="mt-4 grid gap-5 sm:grid-cols-2 sm:gap-6">
    {[{label:"Settled-equity time-weighted return",value:historical.twrPercent,detail:"Compounds realized event returns, excluding deposits and withdrawals."},
      {label:"Net P&L as % of deposits",value:historical.simplePnlPercent,detail:"Simple cumulative net P&L divided by confirmed deposits; not annualized."}].map((metric,index)=>
     <div key={metric.label} className={index===1?"border-t border-[#EDF0F5] pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0":""}>
      <p className="text-sm text-[#64748B]">{metric.label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#11263E]">{metric.value===null?"—":metric.value.toFixed(2)+"%"}</p>
      <p className="mt-2 text-xs leading-5 text-[#64748B]">{metric.detail}</p>
     </div>)}
   </div>
  </section>
  <PnlPerformanceChart rows={settled.filter(p=>p.settledAt).map(p=>({day:p.settledAt!.toISOString().slice(0,10),netMicros:(p.netPnlUsdcMicros??0n).toString()}))}/>
  <div className="flex justify-end"><a href="/api/earn/reports/trade-pnl.csv" className="rounded-xl border border-[#635BFF] px-4 py-2 text-sm font-semibold text-[#635BFF]">Export settled event report (CSV)</a></div>
  <section aria-labelledby="period-heading" className="overflow-hidden rounded-[24px] border border-[#E3E8EE] bg-white">
   <div className="border-b border-[#EDF0F5] px-5 py-5 sm:px-7 sm:py-6">
    <h2 id="period-heading" className="text-lg font-semibold tracking-tight text-[#11263E]">Realized P&amp;L</h2>
    <p className="mt-1 text-sm text-[#64748B]">Settled investment results</p>
    <div className="mt-5">
     <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Lifetime net P&amp;L</p>
     <p className={"mt-2 break-words text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl "+(realized<0n?"text-red-600":realized>0n?"text-emerald-700":"text-[#11263E]")}>{realized>0n?"+":""}{formatUsdc(realized)}</p>
    </div>
   </div>
   <div className="grid grid-cols-1 sm:grid-cols-3">
    {periods.map((period,index)=><div key={period.label} className={"min-w-0 px-5 py-5 sm:px-7 sm:py-6 "+(index>0?"border-t border-[#EDF0F5] sm:border-l sm:border-t-0":"")}>
     <p className="text-sm font-medium text-[#64748B]">{period.label}</p>
     <p className={"mt-2 break-words text-xl font-semibold tabular-nums "+(period.value<0n?"text-red-600":period.value>0n?"text-emerald-700":"text-[#11263E]")}>{period.value>0n?"+":""}{formatUsdc(period.value)}</p>
    </div>)}
   </div>
   <p className="border-t border-[#EDF0F5] bg-[#FAFBFD] px-5 py-3 text-xs leading-5 text-[#64748B] sm:px-7">Values are realized net USDC profit or loss from settled trades. Deposits and withdrawals are excluded; these are not percentage returns.</p>
  </section>
  <section aria-labelledby="settlement-highlights-heading" className="overflow-hidden rounded-[24px] border border-[#E3E8EE] bg-white">
   <div className="border-b border-[#EDF0F5] px-5 py-5 sm:px-7">
    <h2 id="settlement-highlights-heading" className="text-lg font-semibold tracking-tight text-[#11263E]">Settlement highlights</h2>
    <p className="mt-1 text-xs text-[#64748B]">Performance across settled trading events</p>
   </div>
   <div className="grid grid-cols-2">
    {[
     {label:"Settled events",value:String(settled.length),tone:"text-[#11263E]"},
     {label:"Win rate",value:winning+losing>0?(winning*100/(winning+losing)).toFixed(1)+"%":"—",tone:"text-[#11263E]"},
     {label:"Best event",value:best===null?"—":formatUsdc(best),tone:best===null?"text-[#11263E]":best>=0n?"text-emerald-700":"text-red-600"},
     {label:"Worst event",value:worst===null?"—":formatUsdc(worst),tone:worst===null?"text-[#11263E]":worst<0n?"text-red-600":"text-emerald-700"},
    ].map((metric,index)=>
     <div key={metric.label} className={"min-w-0 px-4 py-5 sm:px-7 sm:py-6 "+(index%2===1?"border-l border-[#EDF0F5] ":"")+(index>=2?"border-t border-[#EDF0F5] ":"")}>
      <p className="text-xs font-medium text-[#64748B] sm:text-sm">{metric.label}</p>
      <p className={"mt-2 break-words text-xl font-semibold tabular-nums tracking-tight sm:text-2xl "+metric.tone}>{metric.value}</p>
     </div>)}
   </div>
  </section>
  <section aria-label="Position performance" className="rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
   <h2 className="text-lg font-semibold text-[#11263E]">Position performance</h2>
   <p className="mt-1 text-sm text-[#64748B]">Current invested balances include retained settled profits and losses.</p>
   <div role="region" aria-label="Scrollable position performance table" tabIndex={0} className="mt-5 max-w-full overflow-x-auto overscroll-x-contain"><table className="w-full min-w-[720px] border-collapse text-left text-sm">
    <thead className="bg-[#F8FAFC] text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]"><tr><th className="py-3">Strategy / Position</th><th>Status</th><th className="text-right">Allocated</th><th className="text-right">Settled events</th><th className="text-right">Lifetime net P&amp;L</th></tr></thead>
    <tbody>{pagedPositions.map(p=>{const stats=statsByPosition.get(p.id);return <tr key={p.id} className="border-t border-[#EDF0F5]">
     <td className="py-3"><p className="font-semibold text-[#11263E]">{p.strategy.name}</p><p className="font-mono text-xs text-[#64748B]">{p.id}</p></td><td>{p.status}</td>
     <td className="text-right tabular-nums">{formatUsdc(p.allocatedUsdcMicros)}</td>
     <td className="text-right tabular-nums">{stats?stats._count._all:0}</td>
     <td className={"text-right tabular-nums font-semibold "+((stats?._sum.netPnlUsdcMicros??0n)<0n?"text-red-600":"text-emerald-700")}>{formatUsdc(stats?._sum.netPnlUsdcMicros??0n)}</td>
    </tr>})}{positions.length===0&&<tr><td colSpan={5} className="py-6 text-sm text-[#64748B]">No positions yet.</td></tr>}</tbody>
   </table></div>
   <TablePager page={positionsPage} pages={positionPages} name="positionsPage" otherPage={tradesPage} otherName="tradesPage"/>
  </section>
  <section aria-label="Trade P&L history" className="rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8"><h2 className="text-lg font-semibold text-[#11263E]">Settled trade history</h2><div role="region" aria-label="Scrollable settled trade history table" tabIndex={0} className="mt-5 max-w-full overflow-x-auto overscroll-x-contain"><table className="w-full min-w-[790px] border-collapse text-left text-sm"><thead className="bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wide text-[#64748B]"><tr className="text-left"><th className="py-3">Event</th><th>Settled</th><th className="text-right">Eligible capital</th><th className="text-right">Gross P&amp;L</th><th className="text-right">Fee</th><th className="text-right">Net P&amp;L</th></tr></thead><tbody>{pagedTrades.map(p=><tr key={p.id} className="border-t border-[#E3E8EE]"><td className="py-3">{p.strategyTrade.marketTradeName}</td><td>{p.settledAt?.toLocaleDateString("en-US",{timeZone:"UTC"})}</td><td className="text-right">{formatUsdc(p.eligibleCapitalUsdcMicros)}</td><td className="text-right">{formatUsdc(p.grossPnlUsdcMicros??0n)}</td><td className="text-right">{formatUsdc(p.platformFeeUsdcMicros??0n)}</td><td className={"text-right font-semibold "+((p.netPnlUsdcMicros??0n)<0n?"text-red-600":"text-emerald-600")}>{formatUsdc(p.netPnlUsdcMicros??0n)}</td></tr>)}</tbody></table>{!settled.length&&<p className="py-6 text-sm text-[#64748B]">No verified settled event P&L yet.</p>}</div><TablePager page={tradesPage} pages={tradePages} name="tradesPage" otherPage={positionsPage} otherName="positionsPage"/></section>
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
