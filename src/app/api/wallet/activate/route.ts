import { NextResponse } from "next/server";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { blockradarConfig, createSolanaDepositAddress } from "@/lib/blockradar";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await requireUser();
  if (process.env.BLOCKRADAR_DEPOSITS_ENABLED !== "true") {
    return NextResponse.json({ error: "Wallet activation is not available yet." }, { status: 503 });
  }
  let walletId: string;
  try { walletId = blockradarConfig().walletId; }
  catch { return NextResponse.json({ error: "Wallet activation is not configured." }, { status: 503 }); }

  const existing = await prisma.investorDepositWallet.findUnique({ where: { userId: user.id } });
  if (existing) {
    if (existing.status === "ACTIVE" && existing.address) return NextResponse.json({ address: existing.address, network: "solana", asset: "USDC" });
    return NextResponse.json({ error: "Wallet activation is processing. Contact support if this persists." }, { status: 409 });
  }

  // Unique userId claim prevents concurrent requests from generating multiple addresses.
  try {
    await prisma.investorDepositWallet.create({ data: { userId: user.id, masterWalletId: walletId, status: "CREATING" } });
  } catch {
    return NextResponse.json({ error: "Wallet activation is already processing." }, { status: 409 });
  }

  try {
    const address = await createSolanaDepositAddress(user.id);
    const wallet = await prisma.investorDepositWallet.update({
      where: { userId: user.id },
      data: { status: "ACTIVE", addressId: address.id, address: address.address },
    });
    return NextResponse.json({ address: wallet.address, network: wallet.network, asset: "USDC" });
  } catch (error) {
    // Do not automatically retry an uncertain external create; it may have succeeded remotely.
    console.error("Blockradar address activation requires reconciliation", error);
    await prisma.investorDepositWallet.update({ where: { userId: user.id }, data: { status: "ERROR" } }).catch(() => undefined);
    return NextResponse.json({ error: "Could not activate wallet. Contact support." }, { status: 502 });
  }
}
