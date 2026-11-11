import {prisma} from "@/lib/db";
import {authorizeBotV1} from "@/lib/bot-v1-access";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{strategyId:string}>};
/** Read-only strategy aggregates; investor account identifiers remain private.
 * Managers must never allocate investor capital from bot API credentials. */
export async function GET(request:Request,{params}:Context){
 const {strategyId}=await params;
 const access=await authorizeBotV1(request,strategyId);
 if(!access.ok)return access.response;
 const [strategy,position,investors,pending]=await Promise.all([
  prisma.strategy.findUnique({where:{id:strategyId},select:{status:true}}),
  prisma.investorPosition.aggregate({where:{strategyId,status:{in:["OPEN","CLOSING"]}},
   _sum:{allocatedUsdcMicros:true},_count:{_all:true}}),
  prisma.investorPosition.groupBy({by:["userId"],where:{strategyId,status:{in:["OPEN","CLOSING"]},allocatedUsdcMicros:{gt:0}}}),
  prisma.positionAllocation.aggregate({where:{strategyId,kind:"ALLOCATE",
   status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","AWAITING_DEALLOCATION","AWAITING_WITHDRAWAL","REVIEW"]}},
   _sum:{amountUsdcMicros:true}})
 ]);
 if(!strategy)return Response.json({error:"Strategy not found"},{status:404,headers:access.headers});
 return Response.json({strategy_id:strategyId,status:strategy.status,
  total_allocated_usdc_micros:(position._sum.allocatedUsdcMicros??0n).toString(),
  open_position_count:position._count._all,investor_count:investors.length,
  pending_allocation_usdc_micros:(pending._sum.amountUsdcMicros??0n).toString(),
  accepts_new_allocations:strategy.status==="TRADING"},
  {headers:access.headers});
}
