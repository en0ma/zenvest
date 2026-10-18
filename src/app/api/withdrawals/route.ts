import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";

import { WITHDRAWAL_FEE_USDC_MICROS } from "@/lib/withdrawal-fee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMicros(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^(0|[1-9]\\d*)(\\.\\d{1,6})?$/.test(value)) return null;
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
  if (!amount || typeof address !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))
    return NextResponse.json({error:"Enter a valid USDC amount and Solana address"},{status:400});

  const total = amount + WITHDRAWAL_FEE_USDC_MICROS;
  if (total > 9223372036854775807n) return NextResponse.json({error:"Amount too large"},{status:400});

  try {
    const item = await prisma.$transaction(async tx => {
      const portfolio = await tx.investorPortfolio.findUnique({where:{userId:user.id},select:{id:true}});
      if (!portfolio) return null;
      // Conditional debit atomically reserves funds and prevents concurrent overdrafts.
      const debit = await tx.investorPortfolio.updateMany({
        where:{id:portfolio.id,unallocatedUsdcMicros:{gte:total}},
        data:{unallocatedUsdcMicros:{decrement:total},pendingWithdrawalsUsdcMicros:{increment:total}},
      });
      if (debit.count !== 1) return null;
      const withdrawal = await tx.investorWithdrawal.create({
        data:{userId:user.id,portfolioId:portfolio.id,amountUsdcMicros:amount,feeUsdcMicros:WITHDRAWAL_FEE_USDC_MICROS,destinationAddress:address},
      });
      await tx.investorActivity.create({
        data:{portfolioId:portfolio.id,type:"WITHDRAWAL_REQUESTED",amountKobo:0n,amountUsdcMicros:total,
          reference:`withdrawal:${withdrawal.id}:requested`,description:"Solana USDC withdrawal requested"},
      });
      return withdrawal;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    if (!item) return NextResponse.json({error:"Insufficient available unallocated USDC"},{status:409});
    console.info(JSON.stringify({component:"withdrawal",outcome:"requested",userId:user.id,withdrawalId:item.id}));
    return NextResponse.json({id:item.id,status:item.status,amount:item.amountUsdcMicros.toString(),fee:item.feeUsdcMicros.toString()},{status:201});
  } catch (error) {
    console.error(JSON.stringify({component:"withdrawal",outcome:"request_failed",userId:user.id,errorType:error instanceof Error?error.name:"unknown"}));
    return NextResponse.json({error:"Unable to request withdrawal; retry later"},{status:503});
  }
}
