import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Layers3, Wallet, TrendingUp } from "lucide-react";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatKobo } from "@/lib/investor-money";
export const dynamic = "force-dynamic";
function Metric({label,value,icon:Icon,detail}:{label:string;value:bigint;icon:typeof Wallet;detail:string}){
 return <div className="rounded-2xl bg-white p-6 shadow-soft border border-[#e8ddce]"><div className="flex gap-2 items-center text-muted text-sm"><Icon size={17}/>{label}</div><div className="mt-3 text-2xl font-semibold tracking-tight">{formatKobo(value)}</div><p className="mt-2 text-xs text-muted">{detail}</p></div>;
}
export default async function Dashboard(){
 const session = await requireUser();
 const portfolio = await prisma.investorPortfolio.findUnique({where:{userId:session.id}});
 const activity=portfolio ? await prisma.investorActivity.findMany({where:{portfolioId:portfolio.id},orderBy:{occurredAt:"desc"},take:10}) : [];
 const allocated=portfolio?.allocatedKobo??0n;
 const unallocated=portfolio?.unallocatedKobo??0n;
 const realized=portfolio?.realizedPnlKobo??0n;
 const equity=allocated+unallocated+realized;
 return <Shell><header><h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#292725]">Welcome, {session.name??"Investor"}</h1></header>
 <section className="rounded-3xl bg-forest text-white p-7 sm:p-9 mt-9 shadow-soft"><p className="text-white/70">Portfolio summary</p><h2 className="mt-2 text-4xl sm:text-5xl font-semibold">{formatKobo(equity)}</h2><div className="mt-5 flex items-center gap-2 text-mint"><TrendingUp size={18}/><strong>{formatKobo(realized)}</strong><span className="text-white/60 text-sm">recorded P&L</span></div></section>
 <nav aria-label="Portfolio shortcuts" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mt-5">{[["Deposit","/deposits"],["Transactions","/transactions"],["Withdrawal","/withdrawals"],["Bot monitor","/bot"]].map(([title,href])=><Link key={href} href={href} className="rounded-xl border border-[#e8ddce] bg-white px-5 py-4 font-semibold text-sm text-[#292725] hover:border-[#b77d52] hover:bg-[#faf8f3] transition-colors">{title} <span className="float-right text-[#b77d52]">↗</span></Link>)}</nav>
 <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mt-5" id="allocations">
 <Metric icon={Layers3} label="Allocated capital" value={allocated} detail="Recorded investment allocation"/>
 <Metric icon={Wallet} label="Unallocated capital" value={unallocated} detail="Not currently allocated to trades"/>
 <div id="deposits"><Metric icon={ArrowDownRight} label="Pending deposits" value={portfolio?.pendingDepositsKobo??0n} detail="Awaiting confirmation"/></div>
 <div id="withdrawals"><Metric icon={ArrowUpRight} label="Pending withdrawals" value={portfolio?.pendingWithdrawalsKobo??0n} detail="Recorded pending requests"/></div></section>
 <section id="activity" className="mt-6 rounded-2xl bg-white p-7 border border-[#e8eeea]"><h2 className="text-lg font-semibold">Recent activity</h2>{activity.length===0?<p className="mt-4 text-sm text-muted">No activity recorded yet. Verified account events will appear here.</p>:<ul className="mt-5 divide-y">{activity.map(item=><li key={item.id} className="flex flex-wrap gap-3 justify-between py-4"><div><p className="font-semibold">{item.type.replaceAll("_"," ")}</p><p className="text-sm text-muted">{item.description}</p><p className="text-xs text-muted">{item.occurredAt.toISOString().slice(0,10)}</p></div><span className="font-semibold">{formatKobo(item.amountKobo)}</span></li>)}</ul>}<p className="mt-4 text-xs text-muted">Event history is informational; it is not a reconciled financial ledger.</p></section>
 
 </Shell>;
}
