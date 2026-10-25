import { Shell } from "@/components/shell";
import { EarnActions } from "@/components/earn-actions";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
export const dynamic="force-dynamic";
function date(d:Date|null){return d?d.toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"})+" UTC":null;}
export default async function EarnPage(){
 const user=await requireUser();
 const account=await prisma.user.findUniqueOrThrow({where:{id:user.id},select:{unallocated:true}});
 const [positions,allocations,deallocations,strategies,withdrawalReservations,allocationReservations,deallocationReservations]=await Promise.all([
  prisma.investorPosition.findMany({where:{userId:user.id},orderBy:[{createdAt:"desc"},{id:"desc"}]}),
  prisma.positionAllocation.findMany({where:{userId:user.id,kind:"ALLOCATE"},orderBy:[{createdAt:"desc"},{id:"desc"}],take:100}),
  prisma.positionAllocation.findMany({where:{userId:user.id,kind:"DEALLOCATE"},orderBy:[{createdAt:"desc"},{id:"desc"}],take:100}),
  prisma.strategy.findMany({where:{isActive:true,isPublic:true},orderBy:{name:"asc"}}),
  prisma.withdrawal.aggregate({where:{userId:user.id,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},_sum:{grossUsdcMicros:true}}),
  prisma.positionAllocation.aggregate({where:{userId:user.id,kind:"ALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","REVIEW"]}},_sum:{amountUsdcMicros:true}}),
  prisma.positionAllocation.groupBy({by:["positionId"],where:{userId:user.id,kind:"DEALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","REVIEW"]}},_sum:{amountUsdcMicros:true}}),
 ]);
 const u=account.unallocated,w=withdrawalReservations._sum.grossUsdcMicros??0n,a=allocationReservations._sum.amountUsdcMicros??0n;
 const reservedByPosition=new Map(deallocationReservations.map(x=>[x.positionId,x._sum.amountUsdcMicros??0n]));
 const available=u>w+a?u-w-a:0n;
 return <Shell><div className="mx-auto max-w-6xl space-y-7">
  <EarnActions strategies={strategies.map(x=>({id:x.id,name:x.name,description:x.description,min:x.minAllocationUsdcMicros.toString(),max:x.maxAllocationUsdcMicros.toString(),capacity:x.availableCapacityUsdcMicros.toString()}))} available={available.toString()} positions={positions.map(x=>({id:x.id,strategyId:x.strategyId,principal:x.allocatedUsdcMicros.toString(),reserved:(reservedByPosition.get(x.id)??0n).toString(),status:x.status,created:date(x.createdAt)??"—",pending:deallocations.some(o=>o.positionId===x.id&&["PENDING","SUBMITTING","PROCESSING","REVIEW"].includes(o.status))}))}
   operations={[...allocations.map(x=>({id:x.id,positionId:x.positionId,type:"ALLOCATE",amount:x.amountUsdcMicros.toString(),status:x.status,created:date(x.createdAt)??"—",completed:x.status==="COMPLETED"?date(x.updatedAt):null})),...deallocations.map(x=>({id:x.id,positionId:x.positionId,type:"DEALLOCATE",amount:x.amountUsdcMicros.toString(),status:x.status,created:date(x.createdAt)??"—",completed:x.status==="COMPLETED"?date(x.updatedAt):null}))].sort((a,b)=>b.created.localeCompare(a.created))}/>
 </div></Shell>;
}
