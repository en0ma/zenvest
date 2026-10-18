import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { blockradarConfig } from "@/lib/blockradar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({error:"Forbidden"},{status:403});
  if (process.env.BLOCKRADAR_WITHDRAWALS_ENABLED !== "true") return NextResponse.json({error:"Withdrawals disabled"},{status:503});
  const assetId = process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID;
  if (!assetId) return NextResponse.json({error:"Withdrawal asset not configured"},{status:503});
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({error:"Invalid JSON"},{status:400}); }
  const id = body && typeof body === "object" && "id" in body ? (body as {id:unknown}).id : null;
  if (typeof id !== "string" || !/^c[a-z0-9]{10,40}$/.test(id)) return NextResponse.json({error:"Invalid withdrawal ID"},{status:400});
  const item = await prisma.investorWithdrawal.findUnique({where:{id}});
  if (!item || item.status !== "REQUESTED") return NextResponse.json({error:"Withdrawal not available for execution"},{status:409});
  let key: string, walletId: string;
  try { const conf = blockradarConfig(); key=conf.key; walletId=conf.walletId; }
  catch { return NextResponse.json({error:"Provider unconfigured"},{status:503}); }

  const amount = (item.amountUsdcMicros / 1000000n).toString() + "." + (item.amountUsdcMicros % 1000000n).toString().padStart(6,"0");
  const payload = {assetId,address:item.destinationAddress,amount,reference:`zenvest-withdrawal:${item.id}`};

  // Fee estimation is non-transferring; reject obvious unavailable gas.
  try {
    const feeResponse = await fetch(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(walletId)}/withdraw/network-fee`,{
      method:"POST",headers:{"x-api-key":key,"Content-Type":"application/json"},body:JSON.stringify({assetId,address:item.destinationAddress,amount}),
      cache:"no-store",signal:AbortSignal.timeout(15000),
    });
    if (!feeResponse.ok) return NextResponse.json({error:"Fee estimation unavailable"},{status:503});
    const feeJson: unknown = await feeResponse.json();
    const data = feeJson && typeof feeJson === "object" && "data" in feeJson ? (feeJson as {data:unknown}).data : null;
    const fee = data && typeof data === "object" ? data as Record<string,unknown> : null;
    // Fail closed if provider omits the numeric fee/balance.
    if (!fee || typeof fee.networkFee !== "string" || typeof fee.nativeBalance !== "string" ||
      !/^\\d+(\\.\\d+)?$/.test(fee.networkFee) || !/^\\d+(\\.\\d+)?$/.test(fee.nativeBalance) ||
      Number(fee.nativeBalance) < Number(fee.networkFee))
      return NextResponse.json({error:"Insufficient SOL for network fees or invalid fee estimate"},{status:409});
  } catch { return NextResponse.json({error:"Network fee estimation unavailable"},{status:503}); }

  // A single atomic state claim prevents multiple simultaneous broadcasts.
  const claimed = await prisma.investorWithdrawal.updateMany({where:{id,status:"REQUESTED"},data:{status:"SUBMITTING"}});
  if (claimed.count !== 1) return NextResponse.json({error:"Withdrawal already being processed"},{status:409});
  console.info(JSON.stringify({component:"withdrawal",outcome:"submitting",userId:item.userId,withdrawalId:item.id,adminUserId:session.user.id}));
  try {
    const response = await fetch(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(walletId)}/withdraw`,{
      method:"POST",headers:{"x-api-key":key,"Content-Type":"application/json"},body:JSON.stringify(payload),
      cache:"no-store",signal:AbortSignal.timeout(20000),
    });
    const result: unknown = await response.json().catch(()=>null);
    const data = result && typeof result === "object" && "data" in result ? (result as {data:unknown}).data : null;
    const tx = data && typeof data === "object" ? data as Record<string,unknown> : {};
    if (!response.ok || typeof tx.id !== "string" || !tx.id) throw new Error("Uncertain provider response");
    // A completion webhook might have arrived before this update.
    await prisma.investorWithdrawal.updateMany({
      where:{id,status:"SUBMITTING"},
      data:{status:"PENDING",providerTransactionId:tx.id,transactionHash:typeof tx.hash === "string"?tx.hash:null},
    });
    console.info(JSON.stringify({component:"withdrawal",outcome:"submitted",userId:item.userId,withdrawalId:item.id,providerTransactionId:tx.id}));
    return NextResponse.json({id:item.id,status:"PENDING"});
  } catch (error) {
    // NEVER auto-retry an ambiguous provider call: it might have broadcast funds.
    await prisma.investorWithdrawal.updateMany({where:{id,status:"SUBMITTING"},data:{status:"REVIEW",failureCode:"PROVIDER_OUTCOME_UNKNOWN"}});
    console.error(JSON.stringify({component:"withdrawal",outcome:"manual_review_required",userId:item.userId,withdrawalId:item.id,errorType:error instanceof Error?error.name:"unknown"}));
    return NextResponse.json({error:"Provider outcome uncertain. Check Blockradar before taking further action.",id:item.id},{status:502});
  }
}
