import Link from "next/link";
import { Layers3, Wallet, ArrowUpRight, Radio } from "lucide-react";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
import { botFreshness, usdcFromMicros } from "@/lib/bot-telemetry";
export const dynamic = "force-dynamic";
function Metric({label,value,icon:Icon,detail}:{label:string;value:bigint;icon:typeof Wallet;detail:string}){
 return <article className="border-t border-[#DEE3ED] py-6 sm:py-8"><div className="flex items-center gap-2 text-sm text-[#52637B]">{label}</div><p className="zen-value mt-4 text-3xl sm:text-4xl">{formatUsdc(value)}</p><p className="mt-2 text-xs text-[#52637B]">{detail}</p></article>;
}
export default async function Dashboard(){
 const session = await requireUser();
 const portfolio = await prisma.investorPortfolio.findUnique({where:{userId:session.id}});
 const activity=portfolio ? await prisma.investorActivity.findMany({where:{portfolioId:portfolio.id},orderBy:{occurredAt:"desc"},take:10}) : [];
 const activeTrade=await prisma.activeBotTrade.findFirst({orderBy:{asOf:"desc"}});
 const isDemo=activeTrade?.botId==="sample-bot";
 const activeFresh=activeTrade?(isDemo||botFreshness(activeTrade.asOf)==="CURRENT"):false;
 const allocated=portfolio?.allocatedUsdcMicros??0n;
 const unallocated=portfolio?.unallocatedUsdcMicros??0n;
 const realized=portfolio?.realizedPnlUsdcMicros??0n;
 const equity=allocated+unallocated+realized;
 return <Shell>
 <div className="mx-auto max-w-6xl">
  <header className="mb-12 border-b border-[#DEE3ED] pb-9"><h1 className="text-4xl sm:text-6xl font-semibold tracking-[-.065em] text-[#14253D]">Welcome, {session.name??"Investor"}</h1></header>
  <section aria-label="Portfolio summary" className="border-b border-[#DEE3ED] pb-12">
    <p className="zen-editorial-index">01 / Your capital</p>
    <p className="mt-9 text-sm text-[#52637B]">Portfolio value</p>
    <h2 className="mt-3 break-words text-[clamp(2.9rem,6vw,6.5rem)] font-semibold leading-none tracking-[-.075em] tabular-nums text-[#14253D]">{formatUsdc(equity)}</h2>
    <div className="mt-10 flex flex-wrap items-end justify-between gap-5">
     <div><p className="text-xs text-[#52637B]">Recorded P&amp;L</p><p className="mt-1 text-xl font-semibold tabular-nums text-[#14253D]">{formatUsdc(realized)}</p></div>
     <Link href="/transactions" className="zen-link inline-flex items-center gap-2">View activity <ArrowUpRight size={16}/></Link>
    </div>
  </section>
  <section aria-label="Capital allocation" className="mt-5 grid gap-10 sm:grid-cols-2" id="allocations">
   <Metric icon={Layers3} label="Allocated capital" value={allocated} detail="Recorded investment allocation"/>
   <Metric icon={Wallet} label="Unallocated capital" value={unallocated} detail="Capital not currently allocated to trades"/>
  </section>
  <div className="mt-14 grid gap-12 border-t border-[#DEE3ED] pt-12 xl:grid-cols-[1.25fr_1fr] items-start">
   <section id="activity" className="border-t-2 border-[#14253D] pt-6">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-[#14253D]">Recent activity</h2><Link href="/transactions" className="zen-link">View all <ArrowUpRight size={14} className="inline"/></Link></div>
    {activity.length===0?<div className="mt-7 border-t border-[#DEE3ED] py-8"><p className="font-medium text-[#14253D]">No activity yet</p><p className="mt-2 text-sm leading-6 text-[#52637B]">Your recorded account activity will appear here.</p></div>:<ul className="mt-5 divide-y divide-[#DEE3ED]">{activity.slice(0,5).map(item=><li key={item.id} className="flex flex-wrap justify-between gap-3 py-4"><div><p className="text-sm font-semibold text-[#14253D]">{item.type.replaceAll("_"," ")}</p><p className="mt-1 text-sm text-[#52637B]">{item.description}</p><p className="mt-1 text-xs text-[#52637B]">{item.occurredAt.toISOString().slice(0,10)}</p></div><p className="text-sm font-semibold tabular-nums text-[#14253D]">{formatUsdc(item.amountUsdcMicros)}</p></li>)}</ul>}

   </section>
   <section aria-label="Strategy status" className="zen-panel p-6 sm:p-7">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-[#14253D]">Strategy status</h2><Radio size={18} className="text-[#5145A8]"/></div>
    <p className="mt-1 text-sm text-[#52637B]">Current market overview</p>
    <p className="mt-6 text-xl font-semibold text-[#14253D]">{!activeTrade?"No data available":!activeFresh?"Status unavailable":activeTrade.status.replaceAll("_"," ")}</p>
    <details className="mt-6 border-t border-[#DEE3ED] pt-5"><summary className="cursor-pointer text-sm font-semibold text-[#5145A8]">View market and inventory details</summary><div className="pt-1">    <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
     <div className="col-span-2"><dt className="text-[#52637B]">15-minute Kalshi market</dt><dd className="mt-1 break-words font-semibold text-[#14253D]">{activeFresh?activeTrade?.eventTicker??"No active market":"—"}</dd></div>
     <div><dt className="text-[#52637B]">YES inventory</dt><dd className="mt-1 font-semibold tabular-nums text-[#14253D]">{activeFresh?activeTrade?.yesContracts??0:"—"}</dd></div>
     <div><dt className="text-[#52637B]">NO inventory</dt><dd className="mt-1 font-semibold tabular-nums text-[#14253D]">{activeFresh?activeTrade?.noContracts??0:"—"}</dd></div>
     <div className="col-span-2"><dt className="text-[#52637B]">Combined inventory cost</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-[#14253D]">{activeFresh&&activeTrade?"$"+usdcFromMicros(activeTrade.yesCostUsdcMicros+activeTrade.noCostUsdcMicros)+" USDC":"—"}</dd></div>
    </dl>
</div></details>
    <p className="mt-6 text-xs text-[#52637B]">{activeTrade?(isDemo?"Sample data timestamp: ":"Last reported: ")+activeTrade.asOf.toISOString().replace("T"," ").slice(0,19)+" UTC":"Waiting for a bot status report."}</p>
   </section>
  </div>
 </div>
 </Shell>;
}
