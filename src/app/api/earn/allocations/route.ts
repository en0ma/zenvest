import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser, requireInvestorPermission } from "@/lib/access";
import { prisma } from "@/lib/db";
import {availableUnallocated,canRequestAllocation} from "@/lib/allocation-rules";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function micros(raw: unknown): bigint | null {
  if (typeof raw !== "string" || !/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(raw)) return null;
  const [w, f = ""] = raw.split(".");
  const amount = BigInt(w) * 1000000n + BigInt(f.padEnd(6, "0"));
  return amount > 0n && amount <= 9223372036854775807n ? amount : null;
}

export async function POST(request: Request) {
  const user = await requireUser();
  await requireInvestorPermission(user.id,"allocations:create:own");
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({error:"Invalid JSON"},{status:400}); }
  const body = input && typeof input === "object" ? input as Record<string,unknown> : {};
  const amount = micros(body.amount);
  const strategyId=body.strategyId;
  if(typeof strategyId!=="string" || !strategyId || strategyId.length>64)return NextResponse.json({error:"Select a strategy"},{status:400});
  if (!amount) return NextResponse.json({error:"Invalid allocation amount"},{status:400});
  try {
    const result = await prisma.$transaction(async tx=>{
      // Serialize capacity decisions with admin status changes and other
      // allocations before aggregating investor capital.
      await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${strategyId} FOR UPDATE`;
      const strategy=await tx.strategy.findFirst({where:{id:strategyId,isActive:true,isPublic:true,status:"TRADING"},
       include:{bot:{select:{id:true}}}});
      if(!strategy||!strategy.kalshiWalletAddress||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(strategy.kalshiWalletAddress))return null;
      // Count outstanding requests against the strategy's advertised capacity.
      // Serializable isolation protects the concurrent capacity predicate.
      const outstanding=await tx.positionAllocation.aggregate({
        where:{kind:"ALLOCATE",position:{strategyId},status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","AWAITING_DEALLOCATION","AWAITING_WITHDRAWAL","REVIEW"]}},
        _sum:{amountUsdcMicros:true},
      });

      // For external bot strategies, total capacity includes all already
      // settled investor equity. The old advertised remaining-capacity field
      // alone is not a safe invariant once settlement or P&L changes equity.
      const committed=strategy.bot?await tx.investorPosition.aggregate({where:{
        strategyId,status:{in:["OPEN","CLOSING"]}
      },_sum:{allocatedUsdcMicros:true}}):null;
      const committedCapital=committed?._sum.allocatedUsdcMicros??0n;
      const calculatedRemaining=strategy.bot?
       (strategy.maxCapacityUsdcMicros>committedCapital?strategy.maxCapacityUsdcMicros-committedCapital:0n):
       strategy.availableCapacityUsdcMicros;
      const capacity=strategy.bot?
       (calculatedRemaining<strategy.availableCapacityUsdcMicros?calculatedRemaining:strategy.availableCapacityUsdcMicros):
       strategy.availableCapacityUsdcMicros;
      const balance=await tx.user.findUniqueOrThrow({where:{id:user.id}});
      const [withdrawalHolds,allocationHolds]=await Promise.all([
        tx.withdrawal.aggregate({where:{userId:user.id,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},_sum:{grossUsdcMicros:true}}),
        tx.positionAllocation.aggregate({where:{userId:user.id,kind:"ALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","AWAITING_ALLOCATION","AWAITING_DEALLOCATION","AWAITING_WITHDRAWAL","REVIEW"]}},_sum:{amountUsdcMicros:true}}),
      ]);
      const availableUser=availableUnallocated(balance.unallocated,withdrawalHolds._sum.grossUsdcMicros??0n,allocationHolds._sum.amountUsdcMicros??0n);
      if(!canRequestAllocation({amount,minimum:strategy.minAllocationUsdcMicros,maximum:strategy.maxAllocationUsdcMicros,
        capacity,pendingStrategy:outstanding._sum.amountUsdcMicros??0n,
        availableUser,active:strategy.isActive,isPublic:strategy.isPublic}))return null;
      const existingId=typeof body.positionId==="string"?body.positionId:null;
      // Serialize allocation attempts for this strategy even before the unique
      // index gets a chance to reject a racing INSERT.
      const live=await tx.strategy.findUnique({where:{id:strategyId},select:{status:true,isActive:true,isPublic:true}});
      if(!live||live.status!=="TRADING"||!live.isActive||!live.isPublic)return null;
      // Each new allocation creates a separate position unless a specific OPEN
      // position belonging to this investor and strategy is selected.
      const existing=existingId?await tx.investorPosition.findFirst({where:{
        id:existingId,userId:user.id,strategyId
      }}):null;
      if(existing?.status==="CLOSING")return "POSITION_CLOSING";
      if(existingId&&(!existing||existing.status!=="OPEN"))return "POSITION_MISMATCH";
      const position=existing??await tx.investorPosition.create({data:{
        userId:user.id,strategyId,status:"OPEN"
      }});
      const op=await tx.positionAllocation.create({data:{
        userId:user.id,positionId:position.id,strategyId,
        status:"PENDING",amountUsdcMicros:amount,
      }});
      return {positionId:position.id,operationId:op.id,status:op.status};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    if(result==="POSITION_CLOSING")return NextResponse.json({error:"This position is closing; new allocations are blocked until closure"},{status:409});
    if(result==="POSITION_MISMATCH")return NextResponse.json({error:"Selected position is not open or does not belong to this strategy"},{status:409});
    return result ? NextResponse.json(result,{status:201}) : NextResponse.json({error:"Unavailable strategy or Kalshi wallet address, invalid allocation limits, insufficient strategy capacity or insufficient unallocated USDC"},{status:409});
  }catch(error){
    if(error instanceof Prisma.PrismaClientKnownRequestError && ["P2034","P2002"].includes(error.code))return NextResponse.json({error:"Concurrent request; retry"},{status:409});
    return NextResponse.json({error:"Unable to request allocation"},{status:503});
  }
}
