import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/access";
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
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({error:"Invalid JSON"},{status:400}); }
  const body = input && typeof input === "object" ? input as Record<string,unknown> : {};
  const amount = micros(body.amount);
  const strategyId=body.strategyId;
  if(typeof strategyId!=="string" || !strategyId || strategyId.length>64)return NextResponse.json({error:"Select a strategy"},{status:400});
  if (!amount) return NextResponse.json({error:"Invalid allocation amount"},{status:400});
  try {
    const result = await prisma.$transaction(async tx=>{
      const strategy=await tx.strategy.findFirst({where:{id:strategyId,isActive:true,isPublic:true}});
      if(!strategy||!strategy.kalshiWalletAddress||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(strategy.kalshiWalletAddress))return null;
      // Count outstanding requests against the strategy's advertised capacity.
      // Serializable isolation protects the concurrent capacity predicate.
      const outstanding=await tx.positionAllocation.aggregate({
        where:{kind:"ALLOCATE",position:{strategyId},status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","REVIEW"]}},
        _sum:{amountUsdcMicros:true},
      });

      const balance=await tx.user.findUniqueOrThrow({where:{id:user.id}});
      const [withdrawalHolds,allocationHolds]=await Promise.all([
        tx.withdrawal.aggregate({where:{userId:user.id,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},_sum:{grossUsdcMicros:true}}),
        tx.positionAllocation.aggregate({where:{userId:user.id,kind:"ALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","REVIEW"]}},_sum:{amountUsdcMicros:true}}),
      ]);
      const availableUser=availableUnallocated(balance.unallocated,withdrawalHolds._sum.grossUsdcMicros??0n,allocationHolds._sum.amountUsdcMicros??0n);
      if(!canRequestAllocation({amount,minimum:strategy.minAllocationUsdcMicros,maximum:strategy.maxAllocationUsdcMicros,
        capacity:strategy.availableCapacityUsdcMicros,pendingStrategy:outstanding._sum.amountUsdcMicros??0n,
        availableUser,active:strategy.isActive,isPublic:strategy.isPublic}))return null;
      const existingId=typeof body.positionId==="string"?body.positionId:null;
      // Serialize allocation attempts for this strategy even before the unique
      // index gets a chance to reject a racing INSERT.
      await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${strategyId} FOR UPDATE`;
      const activePositions=await tx.investorPosition.findMany({
        where:{userId:user.id,strategyId,status:{in:["OPEN","CLOSING"]}},
        select:{id:true,status:true},take:2,
      });
      // A legacy duplicate or CLOSING position must never be silently reused,
      // and a caller cannot inject a different position ID.
      if(activePositions.length>1)return "DUPLICATE_POSITION";
      const active=activePositions[0];
      if(active?.status==="CLOSING")return "POSITION_CLOSING";
      if(existingId&&active?.id!==existingId)return "POSITION_MISMATCH";
      if(active&&await tx.positionAllocation.count({where:{positionId:active.id,kind:"DEALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","REVIEW"]}}}))return "POSITION_REDUCING";
      const position=active??await tx.investorPosition.create({data:{userId:user.id,strategyId,status:"OPEN"}});
      const op=await tx.positionAllocation.create({data:{
        userId:user.id,positionId:position.id,strategyId,
        status:"PENDING",amountUsdcMicros:amount,
      }});
      return {positionId:position.id,operationId:op.id,status:op.status};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    if(result==="DUPLICATE_POSITION")return NextResponse.json({error:"Multiple active positions found for this market; contact support for reconciliation"},{status:409});
    if(result==="POSITION_CLOSING")return NextResponse.json({error:"This market position is closing; wait for verified settlement before allocating"},{status:409});
    if(result==="POSITION_REDUCING")return NextResponse.json({error:"Await pending deallocation settlement"},{status:409});
    if(result==="POSITION_MISMATCH")return NextResponse.json({error:"Position does not match the active position for this market"},{status:409});
    return result ? NextResponse.json(result,{status:201}) : NextResponse.json({error:"Unavailable strategy or Kalshi wallet address, invalid allocation limits, insufficient strategy capacity or insufficient unallocated USDC"},{status:409});
  }catch(error){
    if(error instanceof Prisma.PrismaClientKnownRequestError && ["P2034","P2002"].includes(error.code))return NextResponse.json({error:"Concurrent request; retry"},{status:409});
    return NextResponse.json({error:"Unable to request allocation"},{status:503});
  }
}
