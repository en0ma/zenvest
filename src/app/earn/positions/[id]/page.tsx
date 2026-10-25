import Link from "next/link";
import {notFound} from "next/navigation";
import {Shell} from "@/components/shell";
import {PositionCapitalActions} from "@/components/position-capital-actions";
import {requireUser} from "@/lib/access";
import {prisma} from "@/lib/db";
import {usdc} from "@/lib/strategy-market-data";
export const dynamic="force-dynamic";
export default async function PositionPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const user=await requireUser();
 const position=await prisma.investorPosition.findFirst({where:{id,userId:user.id},include:{strategy:true}});
 if(!position)notFound();
 const [trades,requests,account,withdrawalHolds,allocationHolds]=await Promise.all([
  prisma.positionTradePnl.findMany({where:{positionId:id,userId:user.id},include:{strategyTrade:{select:{marketTradeName:true,status:true,marketStart:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}],take:100}),
  prisma.positionAllocation.findMany({where:{positionId:id,userId:user.id},orderBy:[{createdAt:"desc"},{id:"desc"}],take:50}),
  prisma.user.findUniqueOrThrow({where:{id:user.id},select:{unallocated:true}}),
  prisma.withdrawal.aggregate({where:{userId:user.id,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},_sum:{grossUsdcMicros:true}}),
  prisma.positionAllocation.aggregate({where:{userId:user.id,kind:"ALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","REVIEW"]}},_sum:{amountUsdcMicros:true}})
 ]);
 const pendingReduction=requests.filter(r=>r.kind==="DEALLOCATE"&&["PENDING","SUBMITTING"].includes(r.status)).reduce((n,r)=>n+r.amountUsdcMicros,0n);
 const held=(withdrawalHolds._sum.grossUsdcMicros??0n)+(allocationHolds._sum.amountUsdcMicros??0n);
 const free=account.unallocated>held?account.unallocated-held:0n;
 const realized=trades.filter(t=>t.status==="SETTLED").reduce((n,t)=>n+(t.netPnlUsdcMicros??0n),0n);
 return <Shell><div className="mx-auto max-w-6xl space-y-6">
  <Link href={"/earn/strategies/"+encodeURIComponent(position.strategyId)} className="text-sm font-semibold text-[#635BFF]">← {position.strategy.symbol??position.strategy.name}</Link>
  <header><h1 className="text-2xl font-bold text-[#14253D]">Position</h1><p className="mt-2 break-all font-mono text-xs text-[#64748B]">{position.id}</p></header>
  <div className="grid gap-4 sm:grid-cols-3">{[["Allocated",usdc(position.allocatedUsdcMicros)+" USDC"],["Settled net P&L",usdc(realized)+" USDC"],["Status",position.status]].map(([label,value])=><div key={label} className="rounded-xl border border-[#E3E8EE] bg-white p-5"><p className="text-xs text-[#64748B]">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></div>)}</div>
  <PositionCapitalActions strategyId={position.strategyId} positionId={position.id} available={free.toString()} allocated={position.allocatedUsdcMicros.toString()} reserved={pendingReduction.toString()} min={position.strategy.minAllocationUsdcMicros.toString()} max={position.strategy.maxAllocationUsdcMicros.toString()} capacity={position.strategy.availableCapacityUsdcMicros.toString()} status={position.status}/>
  <section className="overflow-hidden rounded-2xl border border-[#E3E8EE] bg-white">
   <header className="border-b px-5 py-5 sm:px-7"><h2 className="text-lg font-semibold">Position trades</h2><p className="mt-1 text-xs text-[#64748B]">Real trade exposure and settled net P&amp;L only</p></header>
   <div className="overflow-x-auto"><table className="w-full min-w-[670px] text-left text-sm"><thead className="bg-[#F8FAFC] text-xs text-[#64748B]"><tr>{["Trade","Status","Exposure USDC","Net P&L USDC","Date"].map(h=><th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y">{trades.map(t=><tr key={t.id}><td className="px-5 py-4">{t.strategyTrade.marketTradeName}</td><td className="px-5 py-4">{t.status}</td><td className="px-5 py-4 tabular-nums">{usdc(t.eligibleCapitalUsdcMicros)}</td><td className="px-5 py-4 tabular-nums">{t.status==="SETTLED"?usdc(t.netPnlUsdcMicros??0n):"—"}</td><td className="px-5 py-4 text-xs">{(t.settledAt??t.createdAt).toLocaleString("en-US",{timeZone:"UTC"})} UTC</td></tr>)}</tbody></table>{trades.length===0&&<p className="p-7 text-sm text-[#64748B]">No position trades recorded yet.</p>}</div>
  </section>
  <section className="overflow-hidden rounded-2xl border border-[#E3E8EE] bg-white"><header className="border-b px-5 py-5 sm:px-7"><h2 className="text-lg font-semibold">Capital requests</h2></header><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-[#F8FAFC] text-xs text-[#64748B]"><tr>{["Type","Amount USDC","Status","Requested"].map(h=><th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y">{requests.map(x=><tr key={x.id}><td className="px-5 py-4">{x.kind}</td><td className="px-5 py-4">{usdc(x.amountUsdcMicros)}</td><td className="px-5 py-4">{x.status}</td><td className="px-5 py-4 text-xs">{x.createdAt.toLocaleString("en-US",{timeZone:"UTC"})} UTC</td></tr>)}</tbody></table>{requests.length===0&&<p className="p-7 text-sm text-[#64748B]">No capital requests yet.</p>}</div></section>
 </div></Shell>;
}
