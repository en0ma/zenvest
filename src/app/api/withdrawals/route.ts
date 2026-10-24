import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";

import { WITHDRAWAL_FEE_USDC_MICROS } from "@/lib/withdrawal-fee";
import {estimateWithdrawalNetworkFee} from "@/lib/blockradar-withdrawal-fee";
import {withdrawalFeeBreakdown} from "@/lib/withdrawal-network-fee";

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
  if (!amount || typeof address !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))
    return NextResponse.json({error:"Enter a valid USDC amount and Solana address"},{status:400});

  if (amount <= WITHDRAWAL_FEE_USDC_MICROS) return NextResponse.json({error:"Amount must exceed the 2 USDC fee"},{status:400});


  try {
    // Re-quote server-side: never trust the browser's fee preview.
    const networkFee=await estimateWithdrawalNetworkFee(address,amount-WITHDRAWAL_FEE_USDC_MICROS);
    const {total:totalFee,net}=withdrawalFeeBreakdown(amount,networkFee);
    if (net <= 0n || totalFee < WITHDRAWAL_FEE_USDC_MICROS || amount !== net + totalFee)
      return NextResponse.json({error:"Invalid withdrawal amount or fee calculation"},{status:400});
    // Do not charge above the fee accepted in the UI; require a fresh quote instead.
    const acceptedFee=input.maxTotalFeeMicros;
    if(typeof acceptedFee!=="string"||!/^\d+$/.test(acceptedFee)||totalFee>BigInt(acceptedFee))
      return NextResponse.json({error:"Network fee changed; review the updated fee and retry"},{status:409});
    const item = await prisma.$transaction(async tx => {
      const balance=await tx.user.findUniqueOrThrow({where:{id:user.id}});
      const [withdrawalHolds,allocationHolds]=await Promise.all([
        tx.withdrawal.aggregate({where:{userId:user.id,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},_sum:{grossUsdcMicros:true}}),
        tx.positionAllocation.aggregate({where:{userId:user.id,kind:"ALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","REVIEW"]}},_sum:{amountUsdcMicros:true}}),
      ]);
      const holds=(withdrawalHolds._sum.grossUsdcMicros??0n)+(allocationHolds._sum.amountUsdcMicros??0n);
      if(balance.unallocated-holds<amount)return null;
      const withdrawal = await tx.withdrawal.create({
        data:{userId:user.id,amountUsdcMicros:net,grossUsdcMicros:amount,asset:"USDC",feeUsdcMicros:totalFee,destinationAddress:address,status:"PENDING"},
      });
      await tx.investorActivity.create({
        data:{userId:user.id,type:"WITHDRAWAL_REQUESTED",amountKobo:0n,amountUsdcMicros:amount,
          reference:`withdrawal:${withdrawal.id}:requested`,description:"Solana USDC withdrawal requested"},
      });
      return withdrawal;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    if (!item) return NextResponse.json({error:"Insufficient unallocated USDC after pending withdrawal and allocation reservations"},{status:409});
    console.info(JSON.stringify({component:"withdrawal",outcome:"requested",userId:user.id,withdrawalId:item.id}));
    return NextResponse.json({id:item.id,status:item.status,gross:item.grossUsdcMicros.toString(),net:item.amountUsdcMicros.toString(),fee:item.feeUsdcMicros.toString()},{status:201});
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code==="P2034")
      return NextResponse.json({error:"Concurrent balance update; please retry"},{status:409});
    console.error(JSON.stringify({component:"withdrawal",outcome:"request_failed",userId:user.id,errorType:error instanceof Error?error.name:"unknown"}));
    return NextResponse.json({error:"Unable to request withdrawal; retry later"},{status:503});
  }
}
