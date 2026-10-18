import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { blockradarConfig } from "@/lib/blockradar";
import { handleWithdrawalWebhook } from "@/lib/withdrawal-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[a-f\d]{128}$/i.test(signature)) return false;
  const actual = Buffer.from(signature, "hex");
  const expected = createHmac("sha512", secret).update(body, "utf8").digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parseUsdcMicros(raw: unknown): bigint | null {
  if (typeof raw !== "string" || !/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const amount = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  return amount > 0n && amount <= 9223372036854775807n ? amount : null;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id") ?? crypto.randomUUID();
  const log = (outcome: string, status: number, extra: Record<string, string | boolean | number> = {}) =>
    console.info(JSON.stringify({ component: "blockradar-webhook", requestId, outcome, status, durationMs: Date.now() - startedAt, ...extra }));

  if (process.env.BLOCKRADAR_DEPOSITS_ENABLED !== "true") {
    log("disabled", 503);
    return NextResponse.json({ error: "Deposit processing disabled" }, { status: 503 });
  }
  let apiKey: string, masterWalletId: string;
  try { const config = blockradarConfig(); apiKey = config.key; masterWalletId = config.walletId; }
  catch { log("unconfigured", 503); return NextResponse.json({ error: "Deposit processing unconfigured" }, { status: 503 }); }

  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-blockradar-signature"), apiKey)) {
    log("invalid_signature", 401);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { log("invalid_json", 400); return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!payload || typeof payload !== "object") { log("invalid_payload", 400); return NextResponse.json({ error: "Invalid payload" }, { status: 400 }); }
  const event = payload as { event?: unknown; data?: Record<string, unknown> };
  if (typeof event.event === "string" && ["withdraw.success","withdraw.failed","withdraw.cancelled"].includes(event.event)) {
    if (!event.data || typeof event.data !== "object") return NextResponse.json({error:"Missing withdrawal data"},{status:400});
    // Settle already submitted transfers even if new withdrawal requests are paused.
    try {
      const outcome = await handleWithdrawalWebhook(event.event,event.data,masterWalletId);
      log("withdrawal_"+outcome,200);
      return NextResponse.json({message:"success"},{status:200,headers:{"Cache-Control":"no-store"}});
    } catch(error) {
      console.error(JSON.stringify({component:"withdrawal-webhook",requestId,outcome:"processing_error",errorType:error instanceof Error?error.name:"unknown"}));
      return NextResponse.json({error:"Withdrawal processing unavailable"},{status:503});
    }
  }
  if (event.event !== "deposit.success") { log("ignored_event", 200); return NextResponse.json({ message: "success" }, { status: 200, headers: { "Cache-Control": "no-store" } }); }
  const data = event.data;
  if (!data || typeof data !== "object") { log("missing_data", 400); return NextResponse.json({ error: "Missing deposit data" }, { status: 400 }); }

  const asset = data.asset && typeof data.asset === "object" ? data.asset as Record<string, unknown> : {};
  const addressRecord = data.address && typeof data.address === "object" ? data.address as Record<string, unknown> : {};
  const allowedMint = process.env.BLOCKRADAR_SOLANA_USDC_MINT;
  if (!allowedMint) { log("missing_mint", 503); return NextResponse.json({ error: "USDC mint not configured" }, { status: 503 }); }
  const depositId = data.id;
  const target = data.recipientAddress;
  const amount = parseUsdcMicros(data.amountPaid ?? data.amount);
  const network = data.network;
  if (data.confirmed !== true || data.status !== "SUCCESS" || data.type !== "DEPOSIT" ||
    asset.symbol !== "USDC" || asset.address !== allowedMint || asset.decimals !== 6 ||
    typeof depositId !== "string" || typeof target !== "string" || typeof data.hash !== "string" ||
    !amount || (network !== "devnet" && network !== "testnet") ||
    (addressRecord.address && addressRecord.address !== target)) {
    log("deposit_not_eligible", 200);
    return NextResponse.json({ message: "success" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
  const wallet = await prisma.investorDepositWallet.findUnique({ where: { address: target } });
  if (!wallet || wallet.status !== "ACTIVE" || wallet.masterWalletId !== masterWalletId ||
      (addressRecord.id && addressRecord.id !== wallet.addressId)) {
    log("unknown_address", 422);
    return NextResponse.json({ error: "Unrecognized deposit address" }, { status: 422 });
  }

  try {
    const credited = await prisma.$transaction(async (tx) => {
      const prior = await tx.blockchainDeposit.findUnique({ where: { providerTransactionId: depositId } });
      if (prior) return false;
      await tx.blockchainDeposit.create({ data: {
        walletId: wallet.id, providerTransactionId: depositId,
        transactionHash: data.hash as string, assetAddress: allowedMint, amountUsdcMicros: amount,
        creditedAt: new Date(),
      } });
      const portfolio = await tx.investorPortfolio.upsert({
        where: { userId: wallet.userId },
        create: { userId: wallet.userId, depositedUsdcMicros: amount, unallocatedUsdcMicros: amount },
        update: { depositedUsdcMicros: { increment: amount }, unallocatedUsdcMicros: { increment: amount } },
      });
      await tx.investorActivity.create({ data: {
        portfolioId: portfolio.id, type: "DEPOSIT_CONFIRMED", amountKobo: 0n,
        amountUsdcMicros: amount, reference: `blockradar:${depositId}`,
        description: "Confirmed Solana USDC deposit",
      } });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    log(credited ? "credited" : "duplicate", 200, { depositId });
    return NextResponse.json({ message: "success" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      log("duplicate_conflict", 200, { depositId });
      return NextResponse.json({ message: "success" }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }
    console.error(JSON.stringify({ component: "blockradar-webhook", requestId, outcome: "database_error", depositId, errorType: error instanceof Error ? error.name : "unknown" }));
    return NextResponse.json({ error: "Deposit processing unavailable" }, { status: 503 });
  }
}
