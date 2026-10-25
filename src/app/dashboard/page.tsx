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
 const account=await prisma.user.findUniqueOrThrow({where:{id:session.id},select:{unallocated:true,handle:true}});
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
 const [sentTransfers,receivedTransfers]=await Promise.all([
  prisma.send.findMany({where:{senderUserId:session.id,status:"COMPLETED"},select:{id:true,createdAt:true,amount:true}}),
  prisma.send.findMany({where:{recipientUserId:session.id,status:"COMPLETED"},select:{id:true,createdAt:true,amount:true}})
 ]);
 const financialEvents:PortfolioEvent[]=[
  ...deposits.filter(d=>d.creditedAt).map(d=>({id:"deposit:"+d.id,at:d.creditedAt!,kind:"DEPOSIT" as const,
   amountMicros:d.amountUsdcMicros})),
  ...withdrawals.filter(w=>w.completedAt).map(w=>({id:"withdrawal:"+w.id,at:w.completedAt!,kind:"WITHDRAWAL" as const,
   amountMicros:-w.grossUsdcMicros})),
  ...sentTransfers.map(p=>({id:"send:"+p.id,at:p.createdAt,kind:"TRANSFER_OUT" as const,amountMicros:-p.amount})),
  ...receivedTransfers.map(p=>({id:"receive:"+p.id,at:p.createdAt,kind:"TRANSFER_IN" as const,amountMicros:p.amount})),
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

 return <Shell><main className="mx-auto max-w-7xl space-y-4 pb-8 text-[#14253D] sm:space-y-5">
  <header className="px-1"><h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1><p className="mt-1 text-xs text-[#64748B]">Welcome back, @{account.handle}</p></header>
  <section aria-label="Portfolio equity and capital" className="rounded-2xl border border-[#E3E8EE] bg-white p-4 sm:p-6">
   <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-[#64748B]">Net portfolio equity</p><span className="rounded-full bg-[#F2F3FF] px-2.5 py-1 text-[11px] font-medium text-[#635BFF]">USDC</span></div>
   <p className="mt-2 break-words text-[clamp(1.8rem,6vw,3.2rem)] font-semibold leading-tight tracking-tight tabular-nums">{formatUsdc(equity)}</p>
   <p className={"mt-1 text-sm font-medium tabular-nums "+(realized>0n?"text-emerald-700":realized<0n?"text-rose-600":"text-[#64748B]")}>{realized>0n?"+":""}{formatUsdc(realized)} <span className="font-normal text-[#64748B]">lifetime settled P&amp;L</span></p>
   <div className="mt-5 border-t border-[#EDF0F5] pt-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Capital allocation</h2><span className="text-xs tabular-nums text-[#64748B]">{allocatedPct.toFixed(1)}% allocated</span></div>
    <div role="img" aria-label={capital>0n?`Allocated ${allocatedPct.toFixed(1)} percent; unallocated ${unallocatedPct.toFixed(1)} percent`:"No available capital"} className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[#EDF0F7]">{capital>0n&&<><div className="bg-[#635BFF]" style={{width:allocatedPct+"%"}}/><div className="bg-[#C7D2FE]" style={{width:unallocatedPct+"%"}}/></>}</div>
    <dl className="mt-3 grid grid-cols-2 gap-3"><div className="min-w-0"><dt className="text-xs text-[#64748B]">Allocated</dt><dd className="mt-1 break-words text-base font-semibold tabular-nums">{formatUsdc(allocated)}</dd></div><div className="min-w-0"><dt className="text-xs text-[#64748B]">Unallocated</dt><dd className="mt-1 break-words text-base font-semibold tabular-nums">{formatUsdc(unallocated)}</dd></div></dl>
    {reserved>0n&&<p className="mt-3 text-xs text-[#64748B]">Pending reservations: {formatUsdc(reserved)}. Reserved funds are not spendable.</p>}
   </div>
  </section>
  <section aria-label="Performance analytics" className="rounded-2xl border border-[#E3E8EE] bg-white p-4 sm:p-6">
   <div className="mb-3 flex items-center justify-between gap-2"><div><h2 className="text-base font-semibold">Performance analytics</h2><p className="mt-1 text-xs text-[#64748B]">Verified settled trades, excluding deposits and withdrawals</p></div></div>
   <PnlPerformanceChart rows={settled.filter(p=>p.settledAt).map(p=>({day:p.settledAt!.toISOString().slice(0,10),netMicros:(p.netPnlUsdcMicros??0n).toString()}))}/>
   <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-[#EDF0F5] pt-4 sm:grid-cols-4">
    <div><dt className="text-[11px] text-[#64748B]">Settled-equity return</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{historical.twrPercent===null?"—":historical.twrPercent.toFixed(2)+"%"}</dd></div>
    <div><dt className="text-[11px] text-[#64748B]">Net P&amp;L / deposits</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{historical.simplePnlPercent===null?"—":historical.simplePnlPercent.toFixed(2)+"%"}</dd></div>
    <div><dt className="text-[11px] text-[#64748B]">Lifetime net P&amp;L</dt><dd className="mt-1 break-words text-lg font-semibold tabular-nums">{realized>0n?"+":""}{formatUsdc(realized)}</dd></div>
    <div><dt className="text-[11px] text-[#64748B]">Verified settlements</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{settled.length}</dd></div>
   </dl>
   <p className="mt-3 text-[11px] leading-5 text-[#94A3B8]">Returns are calculated only when sufficient reconciled history exists. Net P&amp;L / deposits is not annualized.</p>
  </section>
  <section aria-label="Portfolio valuation history" className="rounded-2xl border border-[#E3E8EE] bg-white p-4 sm:p-6">
   <h2 className="text-base font-semibold">Portfolio valuation history</h2>
   <div className="mt-3"><PortfolioValueChart points={historical.completeHistory?historical.points:[]}/></div>{!historical.completeHistory&&<p className="mt-2 text-xs leading-5 text-[#64748B]">History unavailable until deposits, withdrawals, adjustments and trading entries reconcile with the current balance.</p>}
  </section>
  <section aria-label="Realized P&L by period" className="rounded-2xl border border-[#E3E8EE] bg-white p-4 sm:p-6">
   <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">Realized P&amp;L</h2><span className="text-xs text-[#64748B]">Settled results</span></div>
   <div className="mt-3 grid grid-cols-3 gap-2">{periods.map(period=><div key={period.label} className="min-w-0 rounded-xl bg-[#F8FAFC] px-2.5 py-3 sm:p-4"><p className="text-[11px] text-[#64748B]">{period.label}</p><p className={"mt-1 break-words text-sm font-semibold tabular-nums sm:text-lg "+(period.value>0n?"text-emerald-700":period.value<0n?"text-rose-600":"text-[#14253D]")}>{period.value>0n?"+":""}{formatUsdc(period.value)}</p></div>)}</div>
  </section>
  <div className="grid gap-4 lg:grid-cols-2">
   <section aria-labelledby="positions-heading" className="min-w-0 rounded-2xl border border-[#E3E8EE] bg-white p-4 sm:p-6">
    <div className="flex items-center justify-between gap-3"><h2 id="positions-heading" className="text-base font-semibold">Investment positions</h2><Link href="/earn/positions" className="text-xs font-semibold text-[#635BFF]">View positions</Link></div>
    <p className="mt-1 text-xs text-[#64748B]">{positions.length} positions · Settled performance</p>
    {pagedPositions.length?<div className="mt-3 divide-y divide-[#EDF0F5]">{pagedPositions.map(p=>{const s=statsByPosition.get(p.id),net=s?._sum.netPnlUsdcMicros??0n;return <Link key={p.id} href={`/earn/positions/${p.id}`} className="flex items-center justify-between gap-3 py-3 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-[#635BFF]"><div className="min-w-0"><p className="truncate text-sm font-semibold">{p.strategy.name}</p><p className="mt-1 text-xs text-[#64748B]">{p.status} · {formatUsdc(p.allocatedUsdcMicros)} allocated · {s?._count._all??0} settled</p></div><div className="shrink-0 text-right"><p className={"text-sm font-semibold tabular-nums "+(net<0n?"text-rose-600":net>0n?"text-emerald-700":"text-[#14253D]")}>{net>0n?"+":""}{formatUsdc(net)}</p><p className="text-[11px] text-[#94A3B8]">Net P&amp;L ›</p></div></Link>})}</div>:<p className="mt-3 rounded-xl bg-[#F8FAFC] px-3 py-4 text-sm text-[#64748B]">No positions yet. Explore strategies to get started.</p>}
    {positions.length>TABLE_PAGE_SIZE&&<TablePager page={positionsPage} pages={positionPages} name="positionsPage" otherPage={tradesPage} otherName="tradesPage"/>}
   </section>
   <section aria-labelledby="settlement-heading" className="min-w-0 rounded-2xl border border-[#E3E8EE] bg-white p-4 sm:p-6">
    <h2 id="settlement-heading" className="text-base font-semibold">Settlement intelligence</h2><p className="mt-1 text-xs text-[#64748B]">Verified trading outcomes</p>
    <dl className="mt-3 grid grid-cols-2 gap-2">{[
     {label:"Settled events",value:String(settled.length),tone:"text-[#14253D]"},
     {label:"Win rate",value:winning+losing>0?(winning*100/(winning+losing)).toFixed(1)+"%":"—",tone:"text-[#14253D]"},
     {label:"Best event",value:best===null?"—":formatUsdc(best),tone:best!==null&&best<0n?"text-rose-600":"text-[#14253D]"},
     {label:"Worst event",value:worst===null?"—":formatUsdc(worst),tone:worst!==null&&worst<0n?"text-rose-600":"text-[#14253D]"},
    ].map(m=><div key={m.label} className="rounded-xl bg-[#F8FAFC] p-3"><dt className="text-[11px] text-[#64748B]">{m.label}</dt><dd className={"mt-1 break-words text-base font-semibold tabular-nums "+m.tone}>{m.value}</dd></div>)}</dl>
   </section>
  </div>
  <section aria-labelledby="trade-heading" className="rounded-2xl border border-[#E3E8EE] bg-white p-4 sm:p-6">
   <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="trade-heading" className="text-base font-semibold">Settled trade history</h2><p className="mt-1 text-xs text-[#64748B]">Verified event ledger · {settled.length} entries</p></div><a href="/api/earn/reports/trade-pnl.csv" className="rounded-lg border border-[#DCDDFB] px-3 py-2 text-xs font-semibold text-[#635BFF]">Export CSV</a></div>
   {pagedTrades.length?<><div role="region" aria-label="Scrollable settled trade history" tabIndex={0} className="mt-3 max-w-full overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs sm:text-sm"><thead><tr className="border-b border-[#EDF0F5] text-[#64748B]"><th className="py-3 font-medium">Trade</th><th className="font-medium">Settled</th><th className="text-right font-medium">Eligible</th><th className="text-right font-medium">Gross P&amp;L</th><th className="text-right font-medium">Fee</th><th className="text-right font-medium">Net P&amp;L</th></tr></thead><tbody>{pagedTrades.map(p=><tr key={p.id} className="border-b border-[#EDF0F5]"><td className="py-3">{p.strategyTrade.marketTradeName}</td><td>{p.settledAt?.toLocaleDateString("en-US",{timeZone:"UTC"})}</td><td className="text-right tabular-nums">{formatUsdc(p.eligibleCapitalUsdcMicros)}</td><td className="text-right tabular-nums">{formatUsdc(p.grossPnlUsdcMicros??0n)}</td><td className="text-right tabular-nums">{formatUsdc(p.platformFeeUsdcMicros??0n)}</td><td className={"text-right font-semibold tabular-nums "+((p.netPnlUsdcMicros??0n)<0n?"text-rose-600":"text-emerald-700")}>{formatUsdc(p.netPnlUsdcMicros??0n)}</td></tr>)}</tbody></table></div>{settled.length>TABLE_PAGE_SIZE&&<TablePager page={tradesPage} pages={tradePages} name="tradesPage" otherPage={positionsPage} otherName="positionsPage"/>}</>:<p className="mt-3 rounded-xl bg-[#F8FAFC] px-3 py-4 text-sm text-[#64748B]">No verified settled events yet.</p>}
  </section>
  <section aria-labelledby="report-heading" className="rounded-2xl border border-[#E3E8EE] bg-white p-4 sm:p-6">
   <div className="flex items-center gap-2"><FileBarChart2 size={18} className="text-[#635BFF]"/><h2 id="report-heading" className="text-base font-semibold">Performance report</h2></div>
   <dl className="mt-3 divide-y divide-[#EDF0F5]">{[["Recorded capital",formatUsdc(capital)],["Cumulative realized P&L",(realized>0n?"+":"")+formatUsdc(realized)],["Unrealized P&L","Not available"],["Total investment return","Not available"]].map(([label,value])=><div key={label} className="flex items-center justify-between gap-3 py-3 text-sm"><dt className="text-[#64748B]">{label}</dt><dd className="text-right font-semibold tabular-nums">{value}</dd></div>)}</dl>
   <p className="mt-3 text-xs leading-5 text-[#94A3B8]">Unrealized P&amp;L and total investment return require reconciled investment history; deposits and withdrawals are managed in Wallet.</p>
   <a href="/api/earn/reports/trade-pnl.csv" className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-[#DCDDFB] px-4 text-sm font-semibold text-[#635BFF]">Download settled event report (CSV)</a>
  </section>
 </main></Shell>;
}
