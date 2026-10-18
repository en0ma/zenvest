import { NextResponse } from "next/server";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { blockradarConfig, createSolanaDepositAddress } from "@/lib/blockradar";

export const dynamic = "force-dynamic";

export async function POST() {
  const startedAt = Date.now();
  const log = (outcome: string, status: number) =>
    console.info(JSON.stringify({component:"wallet-activation", outcome, status, durationMs:Date.now()-startedAt}));
  const user = await requireUser();
  if (process.env.BLOCKRADAR_DEPOSITS_ENABLED !== "true") {
    log("disabled", 503);
    return NextResponse.json({ error: "Wallet activation is not available yet." }, { status: 503 });
  }
  let walletId: string;
  try { walletId = blockradarConfig().walletId; }
  catch { log("unconfigured", 503); return NextResponse.json({ error: "Wallet activation is not configured." }, { status: 503 }); }

  const existing = await prisma.investorDepositWallet.findUnique({ where: { userId: user.id } });
  if (existing) {
    if (existing.status === "ACTIVE" && existing.address) { log("already_active", 200); return NextResponse.json({ address: existing.address, network: "solana", asset: "USDC" }); }
    log("pending_or_error", 409);
    return NextResponse.json({ error: "Wallet activation is processing. Contact support if this persists." }, { status: 409 });
  }

  // Unique userId claim prevents concurrent requests from generating multiple addresses.
  try {
    await prisma.investorDepositWallet.create({ data: { userId: user.id, masterWalletId: walletId, status: "CREATING" } });
  } catch {
    log("concurrent_activation", 409);
    return NextResponse.json({ error: "Wallet activation is already processing." }, { status: 409 });
  }

  try {
    const address = await createSolanaDepositAddress(user.id);
    const wallet = await prisma.investorDepositWallet.update({
      where: { userId: user.id },
      data: { status: "ACTIVE", addressId: address.id, address: address.address },
    });
    log("activated", 200);
    return NextResponse.json({ address: wallet.address, network: wallet.network, asset: "USDC" });
  } catch (error) {
    // Do not automatically retry an uncertain external create; it may have succeeded remotely.
    console.error(JSON.stringify({component:"wallet-activation",outcome:"provider_or_persistence_error",errorType:error instanceof Error ? error.name : "unknown"}));
    await prisma.investorDepositWallet.update({ where: { userId: user.id }, data: { status: "ERROR" } }).catch(() => undefined);
    log("failed", 502);
    return NextResponse.json({ error: "Could not activate wallet. Contact support." }, { status: 502 });
  }
}
