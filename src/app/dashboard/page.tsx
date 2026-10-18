import { Layers3, Wallet, TrendingUp, Radio } from "lucide-react";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
import { botFreshness, usdcFromMicros } from "@/lib/bot-telemetry";
export const dynamic = "force-dynamic";
function Metric({label,value,icon:Icon,detail}:{label:string;value:bigint;icon:typeof Wallet;detail:string}){
 return <div className="rounded-2xl bg-white p-6 shadow-soft border border-[#e8ddce]"><div className="flex gap-2 items-center text-muted text-sm"><Icon size={17}/>{label}</div><div className="mt-3 text-2xl font-semibold tracking-tight">{formatUsdc(value)}</div><p className="mt-2 text-xs text-muted">{detail}</p></div>;
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
 return <Shell><header><h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#292725]">Welcome, {session.name??"Investor"}</h1></header>
 <section className="rounded-3xl bg-forest text-white p-7 sm:p-9 mt-9 shadow-soft"><p className="text-white/70">Portfolio summary</p><h2 className="mt-2 text-4xl sm:text-5xl font-semibold">{formatUsdc(equity)}</h2><div className="mt-5 flex items-center gap-2 text-mint"><TrendingUp size={18}/><strong>{formatUsdc(realized)}</strong><span className="text-white/60 text-sm">recorded P&L</span></div></section>

 <section className="grid gap-4 md:grid-cols-2 mt-5" id="allocations">
 <Metric icon={Layers3} label="Allocated capital" value={allocated} detail="Recorded investment allocation"/>
 <Metric icon={Wallet} label="Unallocated capital" value={unallocated} detail="Not currently allocated to trades"/>
</section>
 <section className="mt-5 rounded-2xl border border-[#e8ddce] bg-white p-6 sm:p-8"><div className="flex items-center gap-2 text-sm text-[#91603f]"><Radio size={18}/> Bot current status</div><p className="mt-3 text-2xl font-semibold text-[#292725]">{!activeTrade?"No bot data":!activeFresh?"Status unavailable":activeTrade.status.replaceAll("_"," ")}</p><div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4"><div><p className="text-xs text-muted">Current 15-min Kalshi market</p><p className="mt-2 font-semibold break-words">{activeFresh?activeTrade?.eventTicker??"No active market":"—"}</p></div><div><p className="text-xs text-muted">YES inventory</p><p className="mt-2 text-xl font-semibold">{activeFresh?activeTrade?.yesContracts??0:"—"}</p></div><div><p className="text-xs text-muted">NO inventory</p><p className="mt-2 text-xl font-semibold">{activeFresh?activeTrade?.noContracts??0:"—"}</p></div><div><p className="text-xs text-muted">Total inventory cost (USDC)</p><p className="mt-2 text-xl font-semibold">{activeFresh&&activeTrade?"$"+usdcFromMicros(activeTrade.yesCostUsdcMicros+activeTrade.noCostUsdcMicros):"—"}</p></div></div><p className="mt-5 text-xs text-muted">{activeTrade?(isDemo?"Sample data timestamp: ":"Last report: ")+activeTrade.asOf.toISOString().replace("T"," ").slice(0,19)+" UTC":"Waiting for an active bot trade snapshot."}</p></section>
 <section id="activity" className="mt-6 rounded-2xl bg-white p-7 border border-[#e8eeea]"><h2 className="text-lg font-semibold">Recent activity</h2>{activity.length===0?<p className="mt-4 text-sm text-muted">No activity recorded yet. Verified account events will appear here.</p>:<ul className="mt-5 divide-y">{activity.map(item=><li key={item.id} className="flex flex-wrap gap-3 justify-between py-4"><div><p className="font-semibold">{item.type.replaceAll("_"," ")}</p><p className="text-sm text-muted">{item.description}</p><p className="text-xs text-muted">{item.occurredAt.toISOString().slice(0,10)}</p></div><span className="font-semibold">{formatUsdc(item.amountUsdcMicros)}</span></li>)}</ul>}<p className="mt-4 text-xs text-muted">Event history is informational; it is not a reconciled financial ledger.</p></section>
 
 </Shell>;
}
