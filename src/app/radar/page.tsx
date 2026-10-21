import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
export const dynamic="force-dynamic";
export default async function RadarPage(){
 await requireUser();
 const strategies=await prisma.strategy.findMany({where:{isActive:true,isPublic:true},orderBy:{name:"asc"},include:{trades:{select:{realizedPnlUsdcMicros:true,status:true}}}});
 return <Shell><div className="mx-auto max-w-6xl space-y-6">
  <header><h1 className="text-3xl font-semibold text-[#11263E]">Radar</h1><p className="mt-2 text-sm text-[#64748B]">Active public strategies and strategy-wide reported performance. This page contains no investor account data.</p></header>
  {strategies.length===0?<p className="rounded-2xl border bg-white p-8 text-sm text-[#64748B]">No active public strategies available.</p>:
   <div className="grid gap-4 md:grid-cols-2">{strategies.map(strategy=>{
    return <article key={strategy.id} className="rounded-2xl border border-[#E3E8EE] bg-white p-6">
     <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">{strategy.name}</h2><span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs">{strategy.status}</span></div>
     <p className="mt-3 text-sm leading-6 text-[#64748B]">{strategy.description}</p>
     {strategy.marketName&&<p className="mt-3 text-sm text-[#425466]">Market: {strategy.marketName}</p>}
     <dl className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2">
      <div><dt className="text-xs text-[#64748B]">Reported realized P&amp;L</dt><dd className="mt-1 text-lg font-semibold">{strategy.trades.some(t=>t.realizedPnlUsdcMicros!==null)?formatUsdc(strategy.trades.reduce((sum,t)=>sum+(t.realizedPnlUsdcMicros??0n),0n)):"Unavailable"}</dd></div>
      <div><dt className="text-xs text-[#64748B]">Reported unrealized P&amp;L</dt><dd className="mt-1 text-lg font-semibold">{"Unavailable"}</dd></div>
     </dl>
     <p className="mt-4 text-xs text-[#94A3B8]">Strategy telemetry, not verified investor returns. {"Realized P&L uses recorded settled strategy trades; unrealized valuation is not yet implemented"}.</p>
    </article>;
   })}</div>}
 </div></Shell>;
}