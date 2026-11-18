import {Prisma} from "@prisma/client";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {requireStaffPermission} from "@/lib/staff-access";
import {staffWriteError} from "@/lib/staff-write-error";
import {allocationMicros} from "@/lib/bot-strategy-api-schema";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const percent=z.string().regex(/^(?:0|[1-9]\d?\d?)(?:\.\d{1,4})?$/).refine(v=>Number(v)<=100);
const schema=z.object({
 manager_percentage:percent,platform_percentage:percent,
 sandbox_fee_bps:z.number().int().min(0).max(10000),
 admission_min_days:z.number().int().min(1).max(365),
 admission_min_fills:z.number().int().min(1).max(100000),
 admission_max_drawdown_pct:percent,
 total_capacity_usdc:z.string()
}).strict().refine(x=>Number(x.manager_percentage)+Number(x.platform_percentage)<=100,{
 path:["platform_percentage"],message:"Combined revenue percentages cannot exceed 100"
}).refine(x=>allocationMicros(x.total_capacity_usdc)!==null,{
 path:["total_capacity_usdc"],message:"Positive total capacity required"
});
export async function PUT(request:Request,{params}:Context){
 try{
  const actor=await requireStaffPermission("roles:manage",{requireFreshLogin:true});
  const {id}=await params;
  let body:unknown;
  try{body=await request.json()}catch{return Response.json({error:"Invalid JSON"},{status:400})}
  const parsed=schema.safeParse(body);
  if(!parsed.success)return Response.json({error:"Invalid strategy configuration",issues:parsed.error.flatten()},{status:400});
  const d=parsed.data,total=allocationMicros(d.total_capacity_usdc)!;
  const outcome=await prisma.$transaction(async tx=>{
   if(!await tx.userRole.findFirst({where:{userId:actor,role:{key:"super-admin"}}}))return "FORBIDDEN";
   const bot=await tx.bot.findFirst({where:{strategyId:id}});
   if(!bot)return "NOT_FOUND";
   await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${bot.ownerId} FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${id} FOR UPDATE`;
   const current=await tx.strategy.findUniqueOrThrow({where:{id}});
   if(["SHUTTING_DOWN","SHUTDOWN"].includes(current.status))return "LOCKED";
   if(total<current.maxAllocationUsdcMicros)return "CAPACITY_TOO_LOW";
   const [positions,pending]=await Promise.all([
    tx.investorPosition.aggregate({where:{strategyId:id,status:{in:["OPEN","CLOSING"]}},_sum:{allocatedUsdcMicros:true}}),
    tx.positionAllocation.aggregate({where:{strategyId:id,kind:"ALLOCATE",status:{in:[
     "PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","AWAITING_DEALLOCATION","AWAITING_WITHDRAWAL","REVIEW"
    ]}},_sum:{amountUsdcMicros:true}})
   ]);
   const committed=positions._sum.allocatedUsdcMicros??0n;
   const reserved=pending._sum.amountUsdcMicros??0n;
   if(total<committed+reserved)return "CAPACITY_RESERVED";
   const changed=current.managerProfitPercentage.toFixed(4)!==Number(d.manager_percentage).toFixed(4)||
    current.platformStrategyPercentage.toFixed(4)!==Number(d.platform_percentage).toFixed(4);
   await tx.strategy.update({where:{id},data:{
    managerProfitPercentage:d.manager_percentage,platformStrategyPercentage:d.platform_percentage,
    sandboxFeeBps:d.sandbox_fee_bps,admissionMinDays:d.admission_min_days,
    admissionMinFills:d.admission_min_fills,admissionMaxDrawdownPct:d.admission_max_drawdown_pct,
    maxCapacityUsdcMicros:total,availableCapacityUsdcMicros:total-committed
   }});
   if(changed)await tx.strategyRevenueRateVersion.create({data:{
    strategyId:id,managerPct:d.manager_percentage,platformPct:d.platform_percentage,changedBy:actor
   }});
   await tx.staffAudit.create({data:{actorId:actor,action:"bot.strategy.settings.updated",
    resource:"strategies",targetId:id}});
   return "SAVED";
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(outcome==="FORBIDDEN")return Response.json({error:"Super Admin required"},{status:403});
  if(outcome==="NOT_FOUND")return Response.json({error:"Unknown bot-owned strategy"},{status:404});
  if(outcome!=="SAVED")return Response.json({error:outcome},{status:409});
  return Response.json({status:"SAVED"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return staffWriteError(error)}
}
