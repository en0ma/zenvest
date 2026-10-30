import Link from "next/link";
import {ArrowDownToLine,ArrowLeftRight,ArrowRight,ArrowUpFromLine,History,Landmark,Wallet} from "lucide-react";
import {PnlPerformanceChart} from "@/components/pnl-performance-chart";
import {Shell} from "@/components/shell";
import {requireUser} from "@/lib/access";
import {prisma} from "@/lib/db";
import {formatUsdc} from "@/lib/usdc-money";

export const dynamic="force-dynamic";
const card="min-w-0 rounded-2xl border border-[#E3E8EE] bg-white p-4 sm:p-6";
const pendingWithdrawalStatuses=["PENDING","SUBMITTING","PROCESSING","REVIEW"] as const;
const pendingAllocationStatuses=["PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","REVIEW"] as const;
function date(value:Date){return value.toLocaleDateString("en-US",{timeZone:"UTC",month:"short",day:"numeric",year:"numeric"});}
function signed(value:bigint){return (value>0n?"+":"")+formatUsdc(value);}
export default async function Dashboard(){
 const user=await requireUser();
 const [account,positions,settled,deposits,withdrawals,withdrawHolds,allocationHolds,completedAllocations,sendsOut,sendsIn,requests]=await Promise.all([
  prisma.user.findUniqueOrThrow({where:{id:user.id},select:{unallocated:true}}),
  prisma.investorPosition.findMany({where:{userId:user.id},include:{strategy:{select:{name:true}}},orderBy:{createdAt:"desc"}}),
  prisma.positionTradePnl.findMany({where:{userId:user.id,status:"SETTLED",settledAt:{not:null}},orderBy:[{settledAt:"asc"},{id:"asc"}],select:{id:true,settledAt:true,netPnlUsdcMicros:true}}),
  prisma.blockchainDeposit.findMany({where:{wallet:{userId:user.id},status:"CONFIRMED",creditedAt:{not:null}},select:{id:true,creditedAt:true,amountUsdcMicros:true}}),
  prisma.withdrawal.findMany({where:{userId:user.id,status:"COMPLETED",completedAt:{not:null}},select:{id:true,completedAt:true,grossUsdcMicros:true}}),
  prisma.withdrawal.aggregate({where:{userId:user.id,status:{in:[...pendingWithdrawalStatuses]}},_sum:{grossUsdcMicros:true}}),
  prisma.positionAllocation.aggregate({where:{userId:user.id,kind:"ALLOCATE",status:{in:[...pendingAllocationStatuses]}},_sum:{amountUsdcMicros:true}}),
  prisma.positionAllocation.findMany({where:{userId:user.id,status:"COMPLETED"},select:{id:true,kind:true,amountUsdcMicros:true,updatedAt:true}}),
  prisma.send.findMany({where:{senderUserId:user.id,status:"COMPLETED"},select:{id:true,createdAt:true,amount:true}}),
  prisma.send.findMany({where:{recipientUserId:user.id,status:"COMPLETED"},select:{id:true,createdAt:true,amount:true}}),
  prisma.positionAllocation.findMany({where:{userId:user.id},orderBy:{createdAt:"desc"},take:12,select:{id:true,kind:true,status:true,createdAt:true,amountUsdcMicros:true}})
 ]);
 const invested=positions.reduce((sum,p)=>sum+p.allocatedUsdcMicros,0n);
 const total=invested+account.unallocated;
 const held=(withdrawHolds._sum.grossUsdcMicros??0n)+(allocationHolds._sum.amountUsdcMicros??0n);
 const available=account.unallocated>held?account.unallocated-held:0n;
 const totalAdded=deposits.reduce((n,x)=>n+x.amountUsdcMicros,0n);
 const totalWithdrawn=withdrawals.reduce((n,x)=>n+x.grossUsdcMicros,0n);
 const investedOverTime=completedAllocations.filter(x=>x.kind==="ALLOCATE").reduce((n,x)=>n+x.amountUsdcMicros,0n);
 const returnedOverTime=completedAllocations.filter(x=>x.kind==="DEALLOCATE").reduce((n,x)=>n+x.amountUsdcMicros,0n);
 const positionRows=positions.filter(x=>x.allocatedUsdcMicros>0n).slice(0,4);
 const activity=[
  ...deposits.map(x=>({id:"deposit:"+x.id,at:x.creditedAt!,label:"Deposit confirmed",amount:x.amountUsdcMicros,href:"/wallet#wallet-activity"})),
  ...withdrawals.map(x=>({id:"withdraw:"+x.id,at:x.completedAt!,label:"Withdrawal completed",amount:-x.grossUsdcMicros,href:"/wallet#wallet-activity"})),
  ...sendsOut.map(x=>({id:"send:"+x.id,at:x.createdAt,label:"Money sent",amount:-x.amount,href:"/wallet#wallet-activity"})),
  ...sendsIn.map(x=>({id:"receive:"+x.id,at:x.createdAt,label:"Money received",amount:x.amount,href:"/wallet#wallet-activity"})),
  ...completedAllocations.map(x=>({id:"invest:"+x.id,at:x.updatedAt,label:x.kind==="ALLOCATE"?"Investment completed":"Money returned from investment",amount:null as bigint|null,href:"/earn/positions"})),
  ...requests.filter(x=>x.status!=="COMPLETED"&&x.status!=="FAILED"&&x.status!=="CANCELLED").map(x=>({id:"request:"+x.id,at:x.createdAt,label:x.kind==="ALLOCATE"?"Investment request · "+x.status.toLowerCase().replaceAll("_"," "):"Return request · "+x.status.toLowerCase().replaceAll("_"," "),amount:null as bigint|null,href:"/earn/positions"}))
 ].sort((a,b)=>b.at.getTime()-a.at.getTime()||a.id.localeCompare(b.id)).slice(0,6);
 return <Shell><main className="mx-auto max-w-6xl space-y-4 pb-8 text-[#14253D] sm:space-y-5">
  <header className="px-1"><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1><p className="mt-1 text-sm text-[#64748B]">Your money and investments at a glance.</p></header>
  <section aria-label="Total account value" className={card}>
   <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium text-[#64748B]">Total account value</h2><span className="rounded-full bg-[#F2F3FF] px-2.5 py-1 text-xs font-semibold text-[#635BFF]">USDC</span></div>
   <p className="mt-2 break-words text-[clamp(1.8rem,6vw,3.2rem)] font-semibold tracking-tight tabular-nums">{formatUsdc(total)}</p>
   <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[#EDF0F5] pt-4"><div className="min-w-0"><dt className="flex items-center gap-1.5 text-xs text-[#64748B]"><Wallet size={14}/>Available money</dt><dd className="mt-2 break-words text-base font-semibold tabular-nums sm:text-lg">{formatUsdc(available)}</dd></div><div className="min-w-0"><dt className="flex items-center gap-1.5 text-xs text-[#64748B]"><Landmark size={14}/>Money invested</dt><dd className="mt-2 break-words text-base font-semibold tabular-nums sm:text-lg">{formatUsdc(invested)}</dd></div></dl>
   <p className="mt-4 text-xs leading-5 text-[#64748B]">Total account value includes money still being processed, even when it isn't available to use yet.</p>
  </section>
  <section aria-label="Investment performance and your investments" className={card}>
   <PnlPerformanceChart compact rows={settled.map(p=>({day:p.settledAt!.toISOString().slice(0,10),netMicros:(p.netPnlUsdcMicros??0n).toString()}))}/>
   <div className="mt-5 border-t border-[#EDF0F5] pt-5">
    <h3 className="text-sm font-semibold">Investment activity</h3>
    <dl className="mt-3 grid grid-cols-2 gap-3"><div><dt className="text-xs leading-5 text-[#64748B]">Total invested over time</dt><dd className="mt-2 break-words text-base font-semibold tabular-nums">{formatUsdc(investedOverTime)}</dd></div><div><dt className="text-xs leading-5 text-[#64748B]">Total money returned</dt><dd className="mt-2 break-words text-base font-semibold tabular-nums">{formatUsdc(returnedOverTime)}</dd></div></dl>
   </div>
   <div className="mt-5 border-t border-[#EDF0F5] pt-5">
    <div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold">Your investments</h3><Landmark size={18} className="text-[#64748B]"/></div>
    {positionRows.length?<div className="mt-3 divide-y divide-[#EDF0F5]">{positionRows.map(p=><Link key={p.id} href={"/earn/positions/"+p.id} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{p.strategy.name}</span><span className="mt-1 block text-xs text-[#64748B]">{p.status==="CLOSING"?"Closing":"Invested"}</span></span><span className="shrink-0 text-sm font-semibold tabular-nums">{formatUsdc(p.allocatedUsdcMicros)}</span></Link>)}</div>:<p className="mt-3 rounded-xl bg-[#F8FAFC] px-4 py-6 text-center text-sm text-[#64748B]">You haven't invested yet.</p>}
    <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm font-semibold text-[#635BFF]"><Link href="/api/earn/reports/trade-pnl.csv" className="hover:underline">Download trade report</Link><Link href={positionRows.length?"/earn/positions":"/earn"} className="inline-flex items-center gap-1 hover:underline">{positionRows.length?"View all investments":"Explore investments"}<ArrowRight size={16}/></Link></div>
   </div>
  </section>
  <section aria-label="Money flow" className={card}>
   <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">Money flow</h2><ArrowLeftRight size={19} className="text-[#64748B]"/></div>
   <p className="mt-1 text-xs text-[#64748B]">Completed deposits and withdrawals over time.</p>
   <dl className="mt-4 grid grid-cols-2 gap-3"><div className="min-w-0 rounded-xl bg-[#F8FAFC] p-3 sm:p-4"><ArrowDownToLine size={20} className="text-emerald-700"/><dt className="mt-3 text-xs text-[#64748B]">Money added</dt><dd className="mt-1 break-words font-semibold tabular-nums">{formatUsdc(totalAdded)}</dd></div><div className="min-w-0 rounded-xl bg-[#F8FAFC] p-3 sm:p-4"><ArrowUpFromLine size={20} className="text-[#64748B]"/><dt className="mt-3 text-xs text-[#64748B]">Money withdrawn</dt><dd className="mt-1 break-words font-semibold tabular-nums">{formatUsdc(totalWithdrawn)}</dd></div></dl>
   <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EDF0F5] pt-4"><span className="text-sm text-[#64748B]">Net money flow</span><strong className="break-words text-lg tabular-nums">{signed(totalAdded-totalWithdrawn)}</strong></div>
   <p className="mt-2 text-xs leading-5 text-[#64748B]">Money added minus money withdrawn. This is separate from investment profit or loss.</p>
  </section>
  <section aria-label="Recent activity" className={card}>
   <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">Recent activity</h2><History size={19} className="text-[#64748B]"/></div>
   {activity.length?<div className="mt-3 divide-y divide-[#EDF0F5]">{activity.map(x=><Link key={x.id} href={x.href} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0"><span className="block text-sm font-medium">{x.label}</span><span className="mt-1 block text-xs text-[#64748B]">{date(x.at)}</span></span>{x.amount!==null&&<span className={"shrink-0 text-sm font-semibold tabular-nums "+(x.amount>0n?"text-emerald-700":"text-[#14253D]")}>{signed(x.amount)}</span>}</Link>)}</div>:<div className="mt-4 rounded-xl bg-[#F8FAFC] px-4 py-7 text-center"><p className="text-sm font-semibold">No recent activity</p><p className="mt-2 text-xs leading-5 text-[#64748B]">Your latest deposits, withdrawals, transfers and investment transactions will appear here.</p></div>}
   <div className="mt-4 flex justify-end"><Link href="/wallet#wallet-activity" className="inline-flex items-center gap-1 text-sm font-semibold text-[#635BFF] hover:underline">View wallet activity<ArrowRight size={16}/></Link></div>
  </section>
 </main></Shell>;
}
