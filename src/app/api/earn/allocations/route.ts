import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
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
  if (!amount) return NextResponse.json({error:"Invalid allocation amount"},{status:400});
  if (typeof body.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.requestId))
    return NextResponse.json({error:"Invalid request identifier"},{status:400});
  const reference = `position-open:${user.id}:${body.requestId}`;
  try {
    const existing = await prisma.positionAllocation.findUnique({where:{requestKey:reference}});
    if (existing) return existing.amountUsdcMicros===amount
      ? NextResponse.json({positionId:existing.positionId,operationId:existing.id,status:existing.status})
      : NextResponse.json({error:"Request identifier reused"},{status:409});
    const result = await prisma.$transaction(async tx=>{
      const p=await tx.investorPortfolio.findUnique({where:{userId:user.id}});
      if (!p || p.unallocatedUsdcMicros-p.pendingWithdrawalsUsdcMicros-p.pendingAllocationsUsdcMicros<amount) return null;
      const claimed=await tx.investorPortfolio.updateMany({
        where:{id:p.id,unallocatedUsdcMicros:p.unallocatedUsdcMicros,
          pendingWithdrawalsUsdcMicros:p.pendingWithdrawalsUsdcMicros,
          pendingAllocationsUsdcMicros:p.pendingAllocationsUsdcMicros},
        data:{pendingAllocationsUsdcMicros:{increment:amount}},
      });
      if(claimed.count!==1) throw new Error("Concurrent reservation");
      const position=await tx.investorPosition.create({data:{userId:user.id,portfolioId:p.id}});
      const op=await tx.positionAllocation.create({data:{
        userId:user.id,portfolioId:p.id,positionId:position.id,
        status:"PENDING",amountUsdcMicros:amount,requestKey:reference,
      }});
      return {positionId:position.id,operationId:op.id,status:op.status};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    return result ? NextResponse.json(result,{status:201}) : NextResponse.json({error:"Insufficient available unallocated USDC"},{status:409});
  }catch(error){
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code==="P2002") {
      const existing=await prisma.positionAllocation.findUnique({where:{requestKey:reference}});
      if(existing && existing.amountUsdcMicros===amount)
        return NextResponse.json({positionId:existing.positionId,operationId:existing.id,status:existing.status});
    }
    if(error instanceof Prisma.PrismaClientKnownRequestError && error.code==="P2034")return NextResponse.json({error:"Concurrent request; retry"},{status:409});
    return NextResponse.json({error:"Unable to request allocation"},{status:503});
  }
}
