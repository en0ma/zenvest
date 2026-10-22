import { Shell } from "@/components/shell";
import { EarnActions } from "@/components/earn-actions";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
export const dynamic="force-dynamic";
function date(d:Date|null){return d?d.toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"})+" UTC":null;}
export default async function EarnPage(){
 const user=await requireUser();
 const account=await prisma.user.findUniqueOrThrow({where:{id:user.id},select:{unallocated:true}});
 const [positions,allocations,deallocations,strategies,withdrawalReservations]=await Promise.all([
  prisma.investorPosition.findMany({where:{userId:user.id},orderBy:[{createdAt:"desc"},{id:"desc"}]}),
  prisma.positionAllocation.findMany({where:{userId:user.id},orderBy:[{createdAt:"desc"},{id:"desc"}],take:100}),
  prisma.positionDeallocation.findMany({where:{userId:user.id},orderBy:[{createdAt:"desc"},{id:"desc"}],take:100}),
  prisma.strategy.findMany({where:{isActive:true,isPublic:true},orderBy:{name:"asc"}}),
  prisma.investorWithdrawal.aggregate({where:{userId:user.id,status:{in:["PENDING","SUBMITTING","PROCESSING"]}},_sum:{grossUsdcMicros:true}}),
 ]);
 const u=account.unallocated,w=withdrawalReservations._sum.grossUsdcMicros??0n,a=allocations.filter(x=>["PENDING","SUBMITTING","PROCESSING"].includes(x.status)).reduce((total,x)=>total+x.amountUsdcMicros,0n);
 const allocated=positions.reduce((total,x)=>total+x.principalUsdcMicros,0n);
 const available=u>w+a?u-w-a:0n;
 return <Shell><div className="mx-auto max-w-6xl space-y-7">
  <header><h1 className="text-3xl font-semibold tracking-tight text-[#11263E]">Earn</h1><p className="mt-2 text-sm text-[#64748B]">Manage allocations, view investment positions and request return of capital.</p></header>
  <section aria-label="Capital overview" className="grid gap-4 sm:grid-cols-3">
   {[{label:"Portfolio balance",value:allocated+u},{label:"Unallocated balance",value:u},{label:"Available for withdrawal or allocation",value:available}].map(m=>
    <div key={m.label} className="rounded-2xl border border-[#E3E8EE] bg-white p-5"><p className="text-xs text-[#64748B]">{m.label}</p><p className="mt-3 text-xl font-semibold tabular-nums text-[#11263E]">{formatUsdc(m.value)}</p></div>)}
  </section>
  <p className="text-xs text-[#64748B]">Reserved: {formatUsdc(w)} withdrawing + {formatUsdc(a)} allocating. Portfolio = allocated + unallocated; available = max(0, unallocated − reservations).</p>
  <EarnActions strategies={strategies.map(x=>({id:x.id,name:x.name,description:x.description,min:x.minAllocationUsdcMicros.toString(),max:x.maxAllocationUsdcMicros.toString(),capacity:x.availableCapacityUsdcMicros.toString()}))} available={available.toString()} positions={positions.map(x=>({id:x.id,principal:x.principalUsdcMicros.toString(),status:x.status,created:date(x.createdAt)??"—",pending:deallocations.some(o=>o.positionId===x.id&&["PENDING","SUBMITTING","PROCESSING"].includes(o.status))}))}
   operations={[...allocations.map(x=>({id:x.id,positionId:x.positionId,type:"ALLOCATE",amount:x.amountUsdcMicros.toString(),status:x.status,created:date(x.createdAt)??"—",completed:date(x.completedAt)})),...deallocations.map(x=>({id:x.id,positionId:x.positionId,type:"DEALLOCATE",amount:x.amountUsdcMicros.toString(),status:x.status,created:date(x.createdAt)??"—",completed:date(x.completedAt)}))].sort((a,b)=>b.created.localeCompare(a.created))}/>
 </div></Shell>;
}
