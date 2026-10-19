import Link from "next/link";
import { Layers3, Wallet, ArrowUpRight, Radio } from "lucide-react";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
import { botFreshness, usdcFromMicros } from "@/lib/bot-telemetry";
export const dynamic = "force-dynamic";
function Metric({label,value,icon:Icon,detail}:{label:string;value:bigint;icon:typeof Wallet;detail:string}){
 return <article className="rounded-2xl border border-[#E3E8EE] bg-white p-6"><div className="flex items-center gap-2 text-sm text-[#425466]">{label}</div><p className="zen-value mt-4 text-3xl sm:text-4xl">{formatUsdc(value)}</p><p className="mt-2 text-xs text-[#425466]">{detail}</p></article>;
}
export default async function Dashboard(){
 const session = await requireUser();
 const portfolio = await prisma.investorPortfolio.findUnique({where:{userId:session.id}});
 const activeTrade=await prisma.activeBotTrade.findFirst({orderBy:{asOf:"desc"}});
 const isDemo=activeTrade?.botId==="sample-bot";
 const activeFresh=activeTrade?(isDemo||botFreshness(activeTrade.asOf)==="CURRENT"):false;
 const allocated=portfolio?.allocatedUsdcMicros??0n;
 const unallocated=portfolio?.unallocatedUsdcMicros??0n;
 const realized=portfolio?.realizedPnlUsdcMicros??0n;
 const equity=allocated+unallocated+realized;
 return <Shell><div className="mx-auto max-w-7xl">
 <header className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[.15em] text-[#697386]">Your account / Overview</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#0A2540]">Welcome, {session.name??"Investor"}</h1></div><Link href="/wallet" className="rounded-full border border-[#D6DEEA] bg-white px-5 py-2.5 text-sm font-semibold hover:bg-[#F6F9FC]">Manage wallet <ArrowUpRight size={15} className="inline"/></Link></header>
 <div className="grid gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(280px,1fr)]">
 <div className="min-w-0">
  <section aria-label="Portfolio value" className="min-h-[325px] rounded-[28px] bg-gradient-to-br from-[#EEF2FF] via-[#F6F9FC] to-white border border-[#E3E8EE] p-7 sm:p-10 flex flex-col justify-between"><div><p className="text-sm font-medium text-[#425466]">Total portfolio value</p><h2 className="mt-5 break-words text-[clamp(2.8rem,5.3vw,5.8rem)] leading-none font-semibold tracking-[-.075em] tabular-nums text-[#0A2540]">{formatUsdc(equity)}</h2></div><div className="mt-12 flex flex-wrap items-end justify-between gap-5 border-t border-[#D6DEEA] pt-6"><div><p className="text-xs text-[#697386]">Recorded P&amp;L</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatUsdc(realized)}</p></div></div></section>

 </div>
 <aside aria-label="Account snapshot" className="min-w-0 space-y-6">
  <section className="rounded-[24px] border border-[#E3E8EE] bg-white p-7"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Capital breakdown</h2><Layers3 size={18} className="text-[#635BFF]"/></div><div className="mt-8 h-2 overflow-hidden rounded-full bg-[#EEF2FF]"><div className="zen-allocation-bar h-full bg-[#635BFF]" style={{width:(allocated+unallocated)>0n?((allocated*100n/(allocated+unallocated)).toString()+"%"):"0%"}}/></div><dl className="mt-7 divide-y divide-[#E3E8EE]"><div className="py-5"><dt className="text-sm text-[#425466]">Allocated</dt><dd className="mt-2 break-words text-2xl font-semibold tabular-nums">{formatUsdc(allocated)}</dd></div><div className="py-5"><dt className="text-sm text-[#425466]">Unallocated</dt><dd className="mt-2 break-words text-2xl font-semibold tabular-nums">{formatUsdc(unallocated)}</dd></div></dl><Link href="/wallet" className="text-sm font-semibold text-[#635BFF]">Wallet details ↗</Link></section>
  <section className="rounded-[24px] bg-[#F6F9FC] p-7"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Strategy pulse</h2><Radio size={17} className="text-[#635BFF]"/></div><p className="mt-5 text-sm text-[#425466]">Latest operational state</p><p className="mt-2 text-xl font-semibold">{!activeTrade?"No data available":!activeFresh?"Status unavailable":activeTrade.status.replaceAll("_"," ")}</p><details className="mt-6 border-t border-[#D6DED4] pt-4"><summary className="cursor-pointer text-sm font-semibold text-[#635BFF]">Market details</summary><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-[#425466]">Kalshi market</dt><dd className="mt-1 break-all font-medium">{activeFresh?activeTrade?.eventTicker??"No active market":"—"}</dd></div><div className="grid grid-cols-2 gap-4"><div><dt className="text-[#425466]">YES</dt><dd className="font-medium">{activeFresh?activeTrade?.yesContracts??0:"—"}</dd></div><div><dt className="text-[#425466]">NO</dt><dd className="font-medium">{activeFresh?activeTrade?.noContracts??0:"—"}</dd></div></div><div><dt className="text-[#425466]">Inventory cost</dt><dd className="font-medium">{activeFresh&&activeTrade?"$"+usdcFromMicros(activeTrade.yesCostUsdcMicros+activeTrade.noCostUsdcMicros)+" USDC":"—"}</dd></div></dl></details><p className="mt-6 text-xs leading-5 text-[#737C72]">{activeTrade?(isDemo?"Sample data timestamp: ":"Last reported: ")+activeTrade.asOf.toISOString().replace("T"," ").slice(0,19)+" UTC":"Waiting for a bot status report."}</p><Link href="/bot" className="mt-4 inline-flex text-sm font-semibold text-[#635BFF]">View strategy ↗</Link></section>
 </aside></div></div></Shell>;
}
