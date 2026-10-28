import Link from "next/link";
import {notFound} from "next/navigation";
import {Shell} from "@/components/shell";
import {PositionCapitalActions} from "@/components/position-capital-actions";
import {PositionCapitalHistory} from "@/components/position-capital-history";
import {PositionPnlChart} from "@/components/position-pnl-chart";
import {requireUser} from "@/lib/access";
import {prisma} from "@/lib/db";
import {usdc} from "@/lib/strategy-market-data";
export const dynamic="force-dynamic";
export default async function PositionPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const user=await requireUser();
 const position=await prisma.investorPosition.findFirst({where:{id,userId:user.id},include:{strategy:true}});
 if(!position)notFound();
 const [settlements,requests,account,withdrawalHolds,allocationHolds]=await Promise.all([
  prisma.positionTradePnl.findMany({where:{positionId:id,userId:user.id,status:"SETTLED"},orderBy:[{settledAt:"asc"},{id:"asc"}],select:{netPnlUsdcMicros:true,settledAt:true,createdAt:true}}),
  prisma.positionAllocation.findMany({where:{positionId:id,userId:user.id,kind:{in:["ALLOCATE","DEALLOCATE"]}},orderBy:[{createdAt:"desc"},{id:"desc"}],select:{id:true,kind:true,amountUsdcMicros:true,status:true,createdAt:true}}),
  prisma.user.findUniqueOrThrow({where:{id:user.id},select:{unallocated:true}}),
  prisma.withdrawal.aggregate({where:{userId:user.id,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},_sum:{grossUsdcMicros:true}}),
  prisma.positionAllocation.aggregate({where:{userId:user.id,kind:"ALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","REVIEW"]}},_sum:{amountUsdcMicros:true}})
 ]);
 const pendingReduction=requests.filter(r=>r.kind==="DEALLOCATE"&&["PENDING","SUBMITTING"].includes(r.status)).reduce((n,r)=>n+r.amountUsdcMicros,0n);
 const held=(withdrawalHolds._sum.grossUsdcMicros??0n)+(allocationHolds._sum.amountUsdcMicros??0n);
 const free=account.unallocated>held?account.unallocated-held:0n;
 const realized=settlements.reduce((n,t)=>n+(t.netPnlUsdcMicros??0n),0n);
 const points=settlements.map(t=>({time:(t.settledAt??t.createdAt).toISOString(),amount:Number(t.netPnlUsdcMicros??0n)/1e6}));
 const history=requests.map(x=>({id:x.id,kind:x.kind,amount:usdc(x.amountUsdcMicros),status:x.status,date:x.createdAt.toLocaleString("en-US",{timeZone:"UTC",year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"})+" UTC"}));
 return <Shell><div className="mx-auto max-w-7xl space-y-5">
  <Link href={"/earn/strategies/"+encodeURIComponent(position.strategyId)} className="text-sm font-semibold text-[#625DC1]">← {position.strategy.symbol??position.strategy.name}</Link>
  <header className="flex items-center gap-4 rounded-2xl border border-[#DFE5EF] bg-white p-4 text-[#243553] sm:p-6">
   <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#34465E] font-bold">{position.strategy.logo&&(position.strategy.logo.startsWith("/")||position.strategy.logo.startsWith("https://"))?<img src={position.strategy.logo} alt="" className="h-full w-full object-cover"/>:(position.strategy.symbol??position.strategy.name).slice(0,2).toUpperCase()}</span>
   <div className="min-w-0"><h1 className="text-xl font-bold">{position.strategy.symbol??position.strategy.name}</h1><p className="mt-1 text-sm text-[#64748B]">{position.strategy.name}</p><p className="mt-1 break-all font-mono text-xs text-[#A6B3C5]">Position {position.id}</p></div>
  </header>
  <div className="grid gap-3 sm:grid-cols-3">{[
   ["Allocated capital",usdc(position.allocatedUsdcMicros)+" USDC",false],
   ["Settled P&L",(realized>0n?"+":"")+usdc(realized)+" USDC",true],
   ["Total settlements",String(settlements.length),false]
  ].map(([label,value,profit])=><div key={String(label)} className="rounded-2xl border border-[#DFE5EF] bg-[#F8FAFC] p-4"><p className="text-xs text-[#A6B3C5]">{label}</p><p className={"mt-1 text-lg font-semibold tabular-nums "+(profit?(realized<0n?"text-rose-600":"text-emerald-600"):"text-[#243553]")}>{value}</p></div>)}</div>
  <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(300px,1fr)]">
   <PositionPnlChart points={points}/>
   <PositionCapitalActions strategyId={position.strategyId} positionId={position.id} available={free.toString()} allocated={position.allocatedUsdcMicros.toString()} reserved={pendingReduction.toString()} min={position.strategy.minAllocationUsdcMicros.toString()} max={position.strategy.maxAllocationUsdcMicros.toString()} capacity={position.strategy.availableCapacityUsdcMicros.toString()} status={position.status}/>
  </div>
  <PositionCapitalHistory requests={history}/>
 </div></Shell>;
}
