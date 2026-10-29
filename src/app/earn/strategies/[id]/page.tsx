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
 const returns=[["Past hour",periodReturn(3600000)],["Past day",periodReturn(86400000)],["Past 30 days",periodReturn(30*86400000)]] as const;
 const pnlMap=new Map(positionPnls.map(p=>[p.positionId,p._sum.netPnlUsdcMicros??0n]));
 return <Shell><div className="mx-auto max-w-7xl space-y-5">
  <Link href="/earn" className="text-sm font-semibold text-[#635BFF]">← All investment options</Link>
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
  <section aria-label="Your investments" className="rounded-2xl border border-[#E3E8EE] bg-white p-4 text-[#14253D] sm:p-6">
   <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Your investments</h2><span className="text-xs text-[#64748B]">{positions.length} {positions.length===1?"investment":"investments"}</span></div>
   <div className="mt-4 rounded-xl bg-[#F8FAFC] p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[#64748B]">Gains or losses from completed trades</p><p className={"mt-1 text-xl font-semibold tabular-nums "+(positions.reduce((sum,p)=>sum+(pnlMap.get(p.id)??0n),0n)<0n?"text-rose-600":"text-emerald-600")}>{positions.reduce((sum,p)=>sum+(pnlMap.get(p.id)??0n),0n)>0n?"+":""}{usdc(positions.reduce((sum,p)=>sum+(pnlMap.get(p.id)??0n),0n))} USDC</p></div><span aria-hidden="true" className="text-xl text-[#059669]">↗</span></div>
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#E5EAF0] pt-3"><span className="text-xs text-[#64748B]">Total invested</span><span className="text-sm font-semibold tabular-nums">{usdc(positions.reduce((sum,p)=>sum+p.allocatedUsdcMicros,0n))} USDC</span></div>
   </div>
   {positions.length===0?<p className="py-6 text-center text-sm text-[#64748B]">You haven’t invested in this option yet. Enter an amount above to get started.</p>:<div className="mt-3 grid gap-3 sm:grid-cols-2">{positions.map(p=>{const pnl=pnlMap.get(p.id)??0n;return <Link key={p.id} href={"/earn/positions/"+encodeURIComponent(p.id)} aria-label={"Manage position opened "+p.createdAt.toLocaleDateString("en-US",{timeZone:"UTC"})+" with "+usdc(p.allocatedUsdcMicros)+" USDC invested"} className="block rounded-xl border border-[#E5EAF0] p-4 transition hover:border-[#A5A1FF] hover:bg-[#FAFAFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#635BFF]">
    <div className="flex items-center justify-between gap-2"><span className="text-xs text-[#64748B]">Opened {p.createdAt.toLocaleDateString("en-US",{timeZone:"UTC",month:"short",day:"numeric",year:"numeric"})}</span><span className="text-xs capitalize text-[#64748B]">{p.status.toLowerCase()}</span></div>
    <div className="mt-3 flex items-end justify-between gap-3"><div className="min-w-0"><p className="text-[11px] text-[#64748B]">Amount invested</p><p className="whitespace-nowrap text-sm font-semibold tabular-nums">{usdc(p.allocatedUsdcMicros)} USDC</p></div><div className="min-w-0 text-right"><p className="text-[11px] text-[#64748B]">Gains or losses</p><p className={"whitespace-nowrap text-sm font-semibold tabular-nums "+(pnl<0n?"text-rose-600":"text-emerald-600")}>{pnl>0n?"+":""}{usdc(pnl)} USDC</p></div></div>
    <div className="mt-3 flex items-center justify-end gap-1 text-xs font-medium text-[#635BFF]">View investment <span aria-hidden="true">›</span></div>
   </Link>;})}</div>}
  </section>
 </div></Shell>;
}
