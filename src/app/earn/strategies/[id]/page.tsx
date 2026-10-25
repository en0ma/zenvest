import Link from "next/link";
import {notFound} from "next/navigation";
import {Shell} from "@/components/shell";
import {StrategyDetailTabs} from "@/components/strategy-detail-tabs";
import {PositionCapitalActions} from "@/components/position-capital-actions";
import {requireUser} from "@/lib/access";
import {prisma} from "@/lib/db";
import {usdc} from "@/lib/strategy-market-data";
export const dynamic="force-dynamic";
export default async function StrategyPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const user=await requireUser();
 const strategy=await prisma.strategy.findFirst({where:{id,isActive:true,isPublic:true}});
 if(!strategy)notFound();
 const [positions,settled,allPositions,account,withdrawalHolds,allocationHolds]=await Promise.all([
  prisma.investorPosition.findMany({where:{strategyId:id,userId:user.id},orderBy:{createdAt:"desc"}}),
  prisma.positionTradePnl.findMany({where:{strategyTrade:{strategyId:id},status:"SETTLED",settledAt:{not:null}},orderBy:[{settledAt:"asc"},{id:"asc"}],select:{netPnlUsdcMicros:true,settledAt:true}}),
  prisma.investorPosition.aggregate({where:{strategyId:id,status:{in:["OPEN","CLOSING"]}},_sum:{allocatedUsdcMicros:true}}),
  prisma.user.findUniqueOrThrow({where:{id:user.id},select:{unallocated:true}}),
  prisma.withdrawal.aggregate({where:{userId:user.id,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},_sum:{grossUsdcMicros:true}}),
  prisma.positionAllocation.aggregate({where:{userId:user.id,kind:"ALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","REVIEW"]}},_sum:{amountUsdcMicros:true}})
 ]);
 const held=(withdrawalHolds._sum.grossUsdcMicros??0n)+(allocationHolds._sum.amountUsdcMicros??0n);
 const free=account.unallocated>held?account.unallocated-held:0n;
 const points=settled.filter(x=>x.settledAt).map(x=>({time:x.settledAt!.toISOString(),pnl:Number(x.netPnlUsdcMicros??0n)/1e6}));
 return <Shell><div className="mx-auto max-w-6xl space-y-6">
  <Link href="/earn" className="text-sm font-semibold text-[#635BFF]">← All strategies</Link>
  <header className="flex items-center gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#DEE5F2] font-bold">{strategy.logo&&(strategy.logo.startsWith("/")||strategy.logo.startsWith("https://"))?<img src={strategy.logo} alt="" className="h-full w-full object-cover"/>:(strategy.symbol??strategy.name).slice(0,2).toUpperCase()}</span><div><h1 className="text-2xl font-bold text-[#14253D]">{strategy.symbol??strategy.name}</h1><p className="text-sm text-[#64748B]">{strategy.name}</p></div></header>
  <StrategyDetailTabs points={points} description={strategy.description} note={strategy.note} stats={{market:strategy.marketType,status:strategy.status,total:usdc(allPositions._sum.allocatedUsdcMicros??0n),settlements:settled.length,capacity:usdc(strategy.availableCapacityUsdcMicros)}}/>
  <PositionCapitalActions strategyId={id} available={free.toString()} min={strategy.minAllocationUsdcMicros.toString()} max={strategy.maxAllocationUsdcMicros.toString()} capacity={strategy.availableCapacityUsdcMicros.toString()}/>
  <section className="overflow-hidden rounded-2xl border border-[#E3E8EE] bg-white">
   <header className="border-b px-5 py-5 sm:px-7"><h2 className="text-lg font-semibold">Your positions in this strategy</h2></header>
   <div className="overflow-x-auto"><table className="w-full min-w-[570px] text-left text-sm"><thead className="bg-[#F8FAFC] text-xs text-[#64748B]"><tr>{["Position ID","Allocated USDC","Status","Manage"].map(h=><th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y">{positions.map(p=><tr key={p.id}><td className="px-5 py-4 font-mono text-xs">{p.id}</td><td className="px-5 py-4 tabular-nums">{usdc(p.allocatedUsdcMicros)}</td><td className="px-5 py-4">{p.status}</td><td className="px-5 py-4"><Link className="font-semibold text-[#635BFF]" href={"/earn/positions/"+p.id}>View position</Link></td></tr>)}</tbody></table>{positions.length===0&&<p className="p-7 text-sm text-[#64748B]">You do not have any positions in this strategy yet.</p>}</div>
  </section>
 </div></Shell>;
}
