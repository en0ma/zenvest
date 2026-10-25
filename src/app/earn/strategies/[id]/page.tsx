import Link from "next/link";
import {notFound} from "next/navigation";
import {Shell} from "@/components/shell";
import {StrategyDetailTabs} from "@/components/strategy-detail-tabs";
import {PositionCapitalActions} from "@/components/position-capital-actions";
import {requireUser} from "@/lib/access";
import {prisma} from "@/lib/db";
import {usdc,pct} from "@/lib/strategy-market-data";
export const dynamic="force-dynamic";
export default async function StrategyPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const user=await requireUser();
 const strategy=await prisma.strategy.findFirst({where:{id,isActive:true,isPublic:true}});
 if(!strategy)notFound();
 const [positions,settled,allPositions,account,withdrawalHolds,allocationHolds,positionPnls]=await Promise.all([
  prisma.investorPosition.findMany({where:{strategyId:id,userId:user.id},orderBy:{createdAt:"desc"}}),
  prisma.positionTradePnl.findMany({where:{strategyTrade:{strategyId:id},status:"SETTLED",settledAt:{not:null}},orderBy:[{settledAt:"asc"},{id:"asc"}],select:{netPnlUsdcMicros:true,eligibleCapitalUsdcMicros:true,settledAt:true}}),
  prisma.investorPosition.aggregate({where:{strategyId:id,status:{in:["OPEN","CLOSING"]}},_sum:{allocatedUsdcMicros:true}}),
  prisma.user.findUniqueOrThrow({where:{id:user.id},select:{unallocated:true}}),
  prisma.withdrawal.aggregate({where:{userId:user.id,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},_sum:{grossUsdcMicros:true}}),
  prisma.positionAllocation.aggregate({where:{userId:user.id,kind:"ALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","REVIEW"]}},_sum:{amountUsdcMicros:true}}),
  prisma.positionTradePnl.groupBy({by:["positionId"],where:{userId:user.id,position:{strategyId:id},status:"SETTLED"},_sum:{netPnlUsdcMicros:true}})
 ]);
 const held=(withdrawalHolds._sum.grossUsdcMicros??0n)+(allocationHolds._sum.amountUsdcMicros??0n);
 const free=account.unallocated>held?account.unallocated-held:0n;
 const points=settled.filter(x=>x.settledAt).map(x=>({time:x.settledAt!.toISOString(),pnl:Number(x.netPnlUsdcMicros??0n)/1e6}));
 const now=Date.now();
 const periodReturn=(ms:number)=>{const items=settled.filter(x=>x.settledAt&&x.settledAt.getTime()>=now-ms);const sum=items.reduce((a,x)=>a+(x.netPnlUsdcMicros??0n),0n);return pct(sum,items.reduce((a,x)=>a+x.eligibleCapitalUsdcMicros,0n));};
 const returns=[["1H P&L",periodReturn(3600000)],["24H P&L",periodReturn(86400000)],["30D P&L",periodReturn(30*86400000)]] as const;
 const pnlMap=new Map(positionPnls.map(p=>[p.positionId,p._sum.netPnlUsdcMicros??0n]));
 return <Shell><div className="mx-auto max-w-7xl space-y-5">
  <Link href="/earn" className="text-sm font-semibold text-[#635BFF]">← All strategies</Link>
  <header className="rounded-2xl border border-[#E3E8EE] bg-white p-4 text-[#14253D] sm:p-6">
   <div className="flex flex-wrap items-center justify-between gap-6">
    <div className="flex min-w-0 flex-1 items-center gap-3">
     <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#4A698E] bg-[#34465E] font-bold">{strategy.logo&&(strategy.logo.startsWith("/")||strategy.logo.startsWith("https://"))?<img src={strategy.logo} alt="" className="h-full w-full object-cover"/>:(strategy.symbol??strategy.name).slice(0,2).toUpperCase()}</span>
     <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-bold">{strategy.symbol??strategy.name}</h1><p className="mt-1 truncate text-sm text-[#64748B]">{strategy.name}</p></div><span className={"ml-auto shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-medium capitalize "+(strategy.status==="TRADING"?"border-emerald-200 bg-emerald-50 text-emerald-700":"border-[#E2E8F0] bg-[#F1F5F9] text-[#64748B]")}>{strategy.status==="TRADING"?"Trading":strategy.status.toLowerCase()}</span>
    </div>
    <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:gap-5">{returns.map(([label,value])=><div key={label} className="min-w-0 rounded-xl bg-[#F8FAFC] p-3"><p className="text-xs text-[#64748B]">{label}</p><p className={"mt-1 whitespace-nowrap text-sm font-semibold tabular-nums "+(value===null?"text-[#64748B]":value<0?"text-rose-600":"text-emerald-600")}>{value===null?"—":(value>0?"+":"")+value.toFixed(2)+"%"}</p></div>)}</div>
   </div>
  </header>
  <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(300px,1fr)]">
   <div className="min-w-0">
  <StrategyDetailTabs points={points} description={strategy.description} note={strategy.note} stats={{market:strategy.marketType,status:strategy.status,total:usdc(allPositions._sum.allocatedUsdcMicros??0n),settlements:settled.length,capacity:usdc(strategy.availableCapacityUsdcMicros)}}/>
   </div>
   <div className="min-w-0"><PositionCapitalActions strategyId={id} available={free.toString()} min={strategy.minAllocationUsdcMicros.toString()} max={strategy.maxAllocationUsdcMicros.toString()} capacity={strategy.availableCapacityUsdcMicros.toString()}/></div>
  </div>
  <section className="overflow-hidden rounded-2xl border border-[#E3E8EE] bg-white text-[#14253D]">
   <header className="border-b border-[#EDF0F5] px-5 py-5 sm:px-7"><h2 className="text-lg font-semibold">Your positions in this strategy</h2></header>
   <div className="divide-y divide-[#EDF0F5] md:hidden">{positions.map(p=><Link key={p.id} href={"/earn/positions/"+encodeURIComponent(p.id)} className="flex items-center justify-between gap-3 px-4 py-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">Position ···{p.id.slice(-6)}</p><p className="mt-1 text-xs text-[#64748B]">{usdc(p.allocatedUsdcMicros)} USDC allocated · {p.status}</p></div><span className={"shrink-0 text-sm font-semibold tabular-nums "+((pnlMap.get(p.id)??0n)<0n?"text-rose-600":"text-emerald-600")}>{(pnlMap.get(p.id)??0n)>0n?"+":""}{usdc(pnlMap.get(p.id)??0n)}</span></Link>)}{positions.length===0&&<p className="p-5 text-sm text-[#64748B]">No positions yet.</p>}</div>
   <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[750px] text-left text-sm"><thead className="bg-[#293545] text-xs text-[#64748B]"><tr>{["Position ID","Allocated USDC","Settled P&L","Opened","Status","Action"].map(h=><th key={h} className="whitespace-nowrap px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-[#EDF0F5]">{positions.map(p=><tr key={p.id}><td className="whitespace-nowrap px-5 py-4 font-mono text-xs">{p.id}</td><td className="px-5 py-4 tabular-nums">{usdc(p.allocatedUsdcMicros)}</td><td className={"px-5 py-4 tabular-nums "+((pnlMap.get(p.id)??0n)<0n?"text-rose-600":"text-emerald-600")}>{(pnlMap.get(p.id)??0n)>0n?"+":""}{usdc(pnlMap.get(p.id)??0n)}</td><td className="px-5 py-4 whitespace-nowrap text-xs text-[#64748B]">{p.createdAt.toLocaleDateString("en-US",{timeZone:"UTC"})}</td><td className="px-5 py-4">{p.status}</td><td className="px-5 py-4"><Link className="font-semibold text-[#635BFF]" href={"/earn/positions/"+p.id}>View position</Link></td></tr>)}</tbody></table>{positions.length===0&&<p className="p-7 text-sm text-[#64748B]">You do not have any positions in this strategy yet.</p>}</div>
  </section>
 </div></Shell>;
}
