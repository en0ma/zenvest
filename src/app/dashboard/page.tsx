import { ArrowDownRight, ArrowUpRight, Layers3, Wallet, TrendingUp } from "lucide-react";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatKobo } from "@/lib/investor-money";
export const dynamic = "force-dynamic";
function Metric({label,value,icon:Icon,detail}:{label:string;value:bigint;icon:typeof Wallet;detail:string}){
 return <div className="rounded-2xl bg-white p-6 shadow-soft border border-[#e8eeea]"><div className="flex gap-2 items-center text-muted text-sm"><Icon size={17}/>{label}</div><div className="mt-3 text-2xl font-semibold tracking-tight">{formatKobo(value)}</div><p className="mt-2 text-xs text-muted">{detail}</p></div>;
}
export default async function Dashboard(){
 const session = await requireUser();
 const portfolio = await prisma.investorPortfolio.findUnique({where:{userId:session.id}});
 const allocated=portfolio?.allocatedKobo??0n;
 const unallocated=portfolio?.unallocatedKobo??0n;
 const realized=portfolio?.realizedPnlKobo??0n;
 const equity=allocated+unallocated+realized;
 return <Shell><header className="flex flex-wrap justify-between items-start gap-4"><div><p className="text-sm text-muted">Authenticated account · Portfolio reporting</p><h1 className="text-3xl font-semibold mt-2">Welcome, {session.name??"Investor"}</h1><p className="mt-2 text-muted">Account: {session.email}</p></div><span className="rounded-full bg-[#f5ece0] px-4 py-2 text-sm text-forest font-medium">● Account reporting</span></header>
 <section className="rounded-3xl bg-forest text-white p-7 sm:p-9 mt-9 shadow-soft"><p className="text-white/70">Portfolio summary</p><h2 className="mt-2 text-4xl sm:text-5xl font-semibold">{formatKobo(equity)}</h2><div className="mt-5 flex items-center gap-2 text-mint"><TrendingUp size={18}/><strong>{formatKobo(realized)}</strong><span className="text-white/60 text-sm">recorded P&L</span></div></section>
 <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mt-5" id="allocations">
 <Metric icon={Layers3} label="Allocated capital" value={allocated} detail="Never live capital"/>
 <Metric icon={Wallet} label="Unallocated capital" value={unallocated} detail="Not eligible for simulated trade P&L"/>
 <div id="deposits"><Metric icon={ArrowDownRight} label="Pending deposits" value={portfolio?.pendingDepositsKobo??0n} detail="No real deposit processing"/></div>
 <div id="withdrawals"><Metric icon={ArrowUpRight} label="Pending withdrawals" value={portfolio?.pendingWithdrawalsKobo??0n} detail="No withdrawal requests enabled"/></div></section>
 <section className="mt-6 rounded-2xl bg-white p-7 border border-[#e8eeea]"><h2 className="text-lg font-semibold">Account summary</h2><dl className="mt-5 grid sm:grid-cols-2 gap-5 text-sm"><div><dt className="text-muted">Recorded deposits</dt><dd className="font-semibold mt-2">{formatKobo(portfolio?.depositedKobo??0n)}</dd></div><div><dt className="text-muted">Account status</dt><dd className="font-semibold mt-2">No live funds held via this website</dd></div></dl><p className="mt-6 text-xs text-muted">Figures are non-custodial account records, not audited, ledger-backed investor equity. No live deposits, investing or withdrawals are available; trade activity is not yet attributed to investors.</p></section>
 </Shell>;
}
