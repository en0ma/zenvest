import Link from "next/link";
import {Shell} from "@/components/shell";
import {StrategyMarketList} from "@/components/strategy-market-list";
import {requireUser} from "@/lib/access";
import {prisma} from "@/lib/db";
import {strategyMarketRows,usdc} from "@/lib/strategy-market-data";
export const dynamic="force-dynamic";
export default async function EarnPage(){
 const user=await requireUser();
 const [market,positions]=await Promise.all([
  strategyMarketRows(),
  prisma.investorPosition.findMany({where:{userId:user.id},include:{strategy:{select:{name:true,symbol:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}]})
 ]);
 return <Shell><div className="mx-auto max-w-6xl space-y-7">
  <StrategyMarketList rows={market.map(m=>({...m,allocation:m.allocation.toString(),lifetime:m.lifetime.toString(),dayPnl:m.dayPnl.toString()}))}/>
  <section aria-label="All your positions" className="overflow-hidden rounded-2xl border border-[#E3E8EE] bg-white">
   <header className="border-b border-[#EDF0F5] px-5 py-5 sm:px-7"><h2 className="text-lg font-semibold text-[#14253D]">Your positions</h2><p className="mt-1 text-xs text-[#64748B]">All strategies · Select a position to view trades and manage capital</p></header>
   <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-[#F8FAFC] text-xs text-[#64748B]"><tr>{["Strategy","Position","Allocated USDC","Status","Action"].map(h=><th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-[#EDF0F5]">{positions.map(p=><tr key={p.id}><td className="px-5 py-4 font-semibold">{p.strategy.symbol??p.strategy.name}</td><td className="px-5 py-4 font-mono text-xs">{p.id}</td><td className="px-5 py-4 tabular-nums">{usdc(p.allocatedUsdcMicros)}</td><td className="px-5 py-4">{p.status}</td><td className="px-5 py-4"><Link href={"/earn/positions/"+encodeURIComponent(p.id)} className="font-semibold text-[#635BFF] hover:underline">View position</Link></td></tr>)}</tbody></table>{positions.length===0&&<p className="p-8 text-center text-sm text-[#64748B]">No positions yet. Select a strategy above to open one.</p>}</div>
  </section>
 </div></Shell>;
}
