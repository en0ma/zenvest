import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";

import { WITHDRAWAL_FEE_USDC_MICROS } from "@/lib/withdrawal-fee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMicros(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(value)) return null;
  const [whole, part = ""] = value.split(".");
  const micros = BigInt(whole) * 1000000n + BigInt(part.padEnd(6, "0"));
  return micros > 0n && micros <= 9223372036854775807n ? micros : null;
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (process.env.BLOCKRADAR_WITHDRAWALS_ENABLED !== "true") return NextResponse.json({error:"Withdrawals are not yet enabled"},{status:503});
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({error:"Invalid JSON"},{status:400}); }
  if (!body || typeof body !== "object") return NextResponse.json({error:"Invalid request"},{status:400});
  const input = body as Record<string, unknown>;
  const amount = parseMicros(input.amount);
  const address = input.address;
  const idempotencyKey = input.idempotencyKey;
  if (typeof idempotencyKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27,48}$/i.test(idempotencyKey))
    return NextResponse.json({error:"Invalid request identifier"},{status:400});
  if (!amount || typeof address !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))
    return NextResponse.json({error:"Enter a valid USDC amount and Solana address"},{status:400});

  if (amount <= WITHDRAWAL_FEE_USDC_MICROS) return NextResponse.json({error:"Amount must exceed the 2 USDC fee"},{status:400});
  const net = amount - WITHDRAWAL_FEE_USDC_MICROS;

  try {
    // Same user + request key always resolves to one request. A different
    // request payload with a reused key is rejected instead of altered.
    const existing = await prisma.investorWithdrawal.findUnique({where:{
      userId_idempotencyKey:{userId:user.id,idempotencyKey}
    }});
    if (existing) {
      if (existing.grossUsdcMicros!==amount || existing.destinationAddress!==address)
        return NextResponse.json({error:"Request identifier already used for a different withdrawal"},{status:409});
      return NextResponse.json({id:existing.id,status:existing.status,gross:existing.grossUsdcMicros.toString(),
        net:existing.amountUsdcMicros.toString(),fee:existing.feeUsdcMicros.toString()});
    }
    const item = await prisma.$transaction(async tx => {
      const portfolio = await tx.investorPortfolio.findUnique({where:{userId:user.id},
        select:{id:true,allocatedUsdcMicros:true,unallocatedUsdcMicros:true,pendingWithdrawalsUsdcMicros:true,pendingAllocationsUsdcMicros:true}});
      if (!portfolio) return null;
      const total=portfolio.unallocatedUsdcMicros-portfolio.pendingAllocationsUsdcMicros;
      const pendingBefore=portfolio.pendingWithdrawalsUsdcMicros;
      if(total-pendingBefore<amount) return null;
      // Reserve without changing invested/uninvested balances until payout settlement.
      // Conditional compare-and-swap protects concurrent requests and allocations.
      const reserved=await tx.investorPortfolio.updateMany({
        where:{id:portfolio.id,allocatedUsdcMicros:portfolio.allocatedUsdcMicros,
          unallocatedUsdcMicros:portfolio.unallocatedUsdcMicros,pendingAllocationsUsdcMicros:portfolio.pendingAllocationsUsdcMicros,pendingWithdrawalsUsdcMicros:pendingBefore},
        data:{pendingWithdrawalsUsdcMicros:{increment:amount}},
      });
      if(reserved.count!==1) throw new Error("Concurrent balance reservation");
      const withdrawal = await tx.investorWithdrawal.create({
        data:{userId:user.id,portfolioId:portfolio.id,amountUsdcMicros:net,grossUsdcMicros:amount,asset:"USDC",feeUsdcMicros:WITHDRAWAL_FEE_USDC_MICROS,destinationAddress:address,idempotencyKey,status:"PENDING"},
      });
      await tx.investorActivity.create({
        data:{portfolioId:portfolio.id,type:"WITHDRAWAL_REQUESTED",amountKobo:0n,amountUsdcMicros:amount,
          reference:`withdrawal:${withdrawal.id}:requested`,description:"Solana USDC withdrawal requested"},
      });
      return withdrawal;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    if (!item) return NextResponse.json({error:"Insufficient unallocated USDC after pending withdrawal and allocation reservations"},{status:409});
    console.info(JSON.stringify({component:"withdrawal",outcome:"requested",userId:user.id,withdrawalId:item.id}));
    return NextResponse.json({id:item.id,status:item.status,gross:item.grossUsdcMicros.toString(),net:item.amountUsdcMicros.toString(),fee:item.feeUsdcMicros.toString()},{status:201});
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code==="P2002") {
      const prior=await prisma.investorWithdrawal.findUnique({where:{userId_idempotencyKey:{userId:user.id,idempotencyKey}}});
      if(prior && prior.grossUsdcMicros===amount && prior.destinationAddress===address)
        return NextResponse.json({id:prior.id,status:prior.status,gross:prior.grossUsdcMicros.toString(),
          net:prior.amountUsdcMicros.toString(),fee:prior.feeUsdcMicros.toString()});
      return NextResponse.json({error:"Duplicate withdrawal request rejected"},{status:409});
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code==="P2034")
      return NextResponse.json({error:"Concurrent balance update; please retry"},{status:409});
    console.error(JSON.stringify({component:"withdrawal",outcome:"request_failed",userId:user.id,errorType:error instanceof Error?error.name:"unknown"}));
    return NextResponse.json({error:"Unable to request withdrawal; retry later"},{status:503});
  }
}
