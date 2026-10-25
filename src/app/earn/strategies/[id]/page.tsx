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
  prisma.positionTradePnl.findMany({where:{strategyTrade:{strategyId:id},status:"SETTLED",settledAt:{not:null}},orderBy:[{settledAt:"asc"},{id:"asc"}],select:{netPnlUsdcMicros:true,settledAt:true}}),
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
 const periodReturn=(ms:number)=>{const items=settled.filter(x=>x.settledAt&&x.settledAt.getTime()>=now-ms);const sum=items.reduce((a,x)=>a+(x.netPnlUsdcMicros??0n),0n);return pct(sum,BigInt(items.length)* (allPositions._sum.allocatedUsdcMicros??0n));};
 const returns=[["1H P&L",periodReturn(3600000)],["24H P&L",periodReturn(86400000)],["30D P&L",periodReturn(30*86400000)]] as const;
 const pnlMap=new Map(positionPnls.map(p=>[p.positionId,p._sum.netPnlUsdcMicros??0n]));
 return <Shell><div className="mx-auto max-w-7xl space-y-5">
  <Link href="/earn" className="text-sm font-semibold text-[#635BFF]">← All strategies</Link>
  <header className="rounded-2xl border border-[#35404E] bg-[#202934] p-5 text-white sm:p-6">
   <div className="flex flex-wrap items-center justify-between gap-6">
    <div className="flex min-w-0 items-center gap-4">
     <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#4A698E] bg-[#34465E] font-bold">{strategy.logo&&(strategy.logo.startsWith("/")||strategy.logo.startsWith("https://"))?<img src={strategy.logo} alt="" className="h-full w-full object-cover"/>:(strategy.symbol??strategy.name).slice(0,2).toUpperCase()}</span>
     <div><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">{strategy.symbol??strategy.name}</h1><span className={"rounded-full border px-3 py-1 text-xs font-semibold "+(strategy.status==="TRADING"?"border-emerald-700 bg-emerald-950 text-emerald-300":"border-[#5E6C7E] bg-[#303B4B] text-[#C9D2DE]")}>● {strategy.status==="TRADING"?"Trading":strategy.status.toLowerCase()}</span></div><p className="mt-1 text-sm text-[#AAB5C4]">{strategy.name}</p></div>
    </div>
    <div className="flex flex-wrap gap-5 sm:gap-8">{returns.map(([label,value])=><div key={label} className="min-w-[74px]"><p className="text-xs text-[#9DA8B8]">{label}</p><p className={"mt-1 whitespace-nowrap text-lg font-bold tabular-nums "+(value===null?"text-[#AAB5C4]":value<0?"text-rose-400":"text-emerald-300")}>{value===null?"—":(value>0?"+":"")+value.toFixed(2)+"%"}</p></div>)}</div>
   </div>
  </header>
  <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(300px,1fr)]">
   <div className="min-w-0">
  <StrategyDetailTabs points={points} description={strategy.description} note={strategy.note} stats={{market:strategy.marketType,status:strategy.status,total:usdc(allPositions._sum.allocatedUsdcMicros??0n),settlements:settled.length,capacity:usdc(strategy.availableCapacityUsdcMicros)}}/>
   </div>
   <div className="min-w-0"><PositionCapitalActions strategyId={id} available={free.toString()} min={strategy.minAllocationUsdcMicros.toString()} max={strategy.maxAllocationUsdcMicros.toString()} capacity={strategy.availableCapacityUsdcMicros.toString()}/></div>
  </div>
  <section className="overflow-hidden rounded-2xl border border-[#35404E] bg-[#202934] text-white">
   <header className="border-b border-white/10 px-5 py-5 sm:px-7"><h2 className="text-lg font-semibold">Your positions in this strategy</h2></header>
   <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left text-sm"><thead className="bg-[#293545] text-xs text-[#9DA8B8]"><tr>{["Position ID","Allocated USDC","Settled P&L","Opened","Status","Action"].map(h=><th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-white/10">{positions.map(p=><tr key={p.id}><td className="px-5 py-4 font-mono text-xs">{p.id}</td><td className="px-5 py-4 tabular-nums">{usdc(p.allocatedUsdcMicros)}</td><td className={"px-5 py-4 tabular-nums "+((pnlMap.get(p.id)??0n)<0n?"text-rose-400":"text-emerald-300")}>{(pnlMap.get(p.id)??0n)>0n?"+":""}{usdc(pnlMap.get(p.id)??0n)}</td><td className="px-5 py-4 whitespace-nowrap text-xs text-[#AAB5C4]">{p.createdAt.toLocaleDateString("en-US",{timeZone:"UTC"})}</td><td className="px-5 py-4">{p.status}</td><td className="px-5 py-4"><Link className="font-semibold text-amber-300" href={"/earn/positions/"+p.id}>View position</Link></td></tr>)}</tbody></table>{positions.length===0&&<p className="p-7 text-sm text-[#64748B]">You do not have any positions in this strategy yet.</p>}</div>
  </section>
 </div></Shell>;
}
