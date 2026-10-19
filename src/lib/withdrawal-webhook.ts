import { Prisma } from "@prisma/client";
import { journeyLog } from "@/lib/journey-log";
import { prisma } from "@/lib/db";

// Called only after the Blockradar HMAC signature has been verified.
export async function handleWithdrawalWebhook(event: string, data: Record<string,unknown>, masterWalletId: string) {
  if (!["withdraw.success","withdraw.failed","withdraw.cancelled"].includes(event)) return "ignored";
  const reference = data.reference;
  if (typeof reference !== "string" || !/^zenvest-withdrawal:c[a-z0-9]{10,40}$/.test(reference)) return "unrelated";
  const id = reference.slice("zenvest-withdrawal:".length);
  const item = await prisma.investorWithdrawal.findUnique({where:{id}});
  if (!item) return "unknown_withdrawal";
  const asset = data.asset && typeof data.asset === "object" ? data.asset as Record<string,unknown> : {};
  const wallet = data.wallet && typeof data.wallet === "object" ? data.wallet as Record<string,unknown> : {};
  const amount = (item.amountUsdcMicros / 1000000n).toString() + "." + (item.amountUsdcMicros % 1000000n).toString().padStart(6,"0");
  const validAmount = typeof data.amount === "string" && /^\d+(\.\d{1,6})?$/.test(data.amount) &&
    BigInt(data.amount.split(".")[0]) * 1000000n + BigInt((data.amount.split(".")[1] ?? "").padEnd(6,"0")) === item.amountUsdcMicros;
  const validNetwork = data.network === "testnet" || data.network === "devnet";
  const mint = process.env.BLOCKRADAR_SOLANA_USDC_MINT;
  const transactionId = data.id;
  if (!mint || typeof transactionId !== "string" || !transactionId ||
    wallet.id !== masterWalletId || data.type !== "WITHDRAW" || !validNetwork ||
    asset.symbol !== "USDC" || asset.decimals !== 6 ||
    (asset.address !== mint && data.tokenAddress !== mint) ||
    data.recipientAddress !== item.destinationAddress || !validAmount ||
    (item.providerTransactionId && item.providerTransactionId !== transactionId)) return "mismatch";

  // Blockradar documents withdraw.success as chain-confirmed; its example payload omits confirmed.
  if (event === "withdraw.success" && (data.status !== "SUCCESS" || data.confirmed === false || typeof data.hash !== "string")) return "unconfirmed";
  if (event !== "withdraw.success" && data.status !== "FAILED" && data.status !== "CANCELLED") return "unconfirmed";
  const result = await prisma.$transaction(async tx => {
    const targetStatus = event === "withdraw.success" ? "SUCCESS" : "FAILED";
    // Conditional transition makes duplicate webhooks harmless.
    const updated = await tx.investorWithdrawal.updateMany({
      where:{id,status:{in:["PROCESSING","REVIEW"]}},
      data:{status:targetStatus,providerTransactionId:transactionId,
        transactionHash:typeof data.hash === "string" ? data.hash : item.transactionHash,
        ...(targetStatus === "SUCCESS" ? {completedAt:new Date()} : {failureCode:event})},
    });
    if (updated.count !== 1) return false;
    const reservedTotal=item.grossUsdcMicros;
    await tx.masterWalletBalance.update({where:{walletId:masterWalletId},data:{reservedUsdcMicros:{decrement:item.amountUsdcMicros},...(targetStatus==="SUCCESS"?{confirmedUsdcMicros:{decrement:item.amountUsdcMicros},feeReserveUsdcMicros:{increment:item.feeUsdcMicros}}:{})}});
    const portfolio=await tx.investorPortfolio.findUniqueOrThrow({where:{id:item.portfolioId}});
    const fromUnallocated=targetStatus==="SUCCESS"
      ? (portfolio.unallocatedUsdcMicros>=reservedTotal?reservedTotal:portfolio.unallocatedUsdcMicros) : 0n;
    const fromAllocated=targetStatus==="SUCCESS"?reservedTotal-fromUnallocated:0n;
    if(fromAllocated>portfolio.allocatedUsdcMicros) throw new Error("Insufficient allocated accounting on settlement");
    await tx.investorPortfolio.update({
      where:{id:item.portfolioId},
      data:{
        pendingWithdrawalsUsdcMicros:{decrement:reservedTotal},
        ...(targetStatus==="SUCCESS"?{
          unallocatedUsdcMicros:{decrement:fromUnallocated},
          allocatedUsdcMicros:{decrement:fromAllocated},
        }:{}),
      },
    });
    if(targetStatus==="FAILED"){
      await tx.withdrawalDeallocation.updateMany({where:{withdrawalId:id,status:"PENDING"},data:{status:"FAILED"}});
    }
    if (targetStatus === "SUCCESS") {
      await tx.investorActivity.create({
        data:{portfolioId:item.portfolioId,type:"WITHDRAWAL_COMPLETED",amountKobo:0n,
          amountUsdcMicros:item.amountUsdcMicros,reference:`withdrawal:${id}:completed`,
          description:`Confirmed Solana USDC withdrawal (fee: ${item.feeUsdcMicros.toString()} micros)`},
      });
    }
    return true;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  journeyLog("info","withdrawal_settlement",result?event:"duplicate",{userId:item.userId,withdrawalId:id,providerTransactionId:transactionId});
  return result ? "settled" : "duplicate";
}
