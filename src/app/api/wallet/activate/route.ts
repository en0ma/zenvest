import { NextResponse } from "next/server";
import { journeyLog } from "@/lib/journey-log";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { blockradarConfig, createSolanaDepositAddress } from "@/lib/blockradar";

export const dynamic = "force-dynamic";

export async function POST() {
  const startedAt = Date.now();
  const user = await requireUser();
  const log = (outcome: string, status: number, details: {walletStatus?:string;providerAddressId?:string} = {}) =>
    journeyLog(status>=500?"error":status>=400?"warn":"info","wallet_activation",outcome,{userId:user.id,status,durationMs:Date.now()-startedAt,...details});
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
    log("pending_or_error", 409, {walletStatus:existing.status});
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
    log("activated", 200, {providerAddressId:address.id});
    return NextResponse.json({ address: wallet.address, network: wallet.network, asset: "USDC" });
  } catch (error) {
    // Do not automatically retry an uncertain external create; it may have succeeded remotely.
    journeyLog("error","wallet_activation","provider_or_persistence_error",{userId:user.id,errorType:error instanceof Error?error.name:"unknown",durationMs:Date.now()-startedAt});
    await prisma.investorDepositWallet.update({ where: { userId: user.id }, data: { status: "ERROR" } }).catch(() => undefined);
    log("failed", 502);
    return NextResponse.json({ error: "Could not activate wallet. Contact support." }, { status: 502 });
  }
}
