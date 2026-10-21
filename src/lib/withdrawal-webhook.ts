import { Prisma } from "@prisma/client";
import { journeyLog } from "@/lib/journey-log";
import { prisma } from "@/lib/db";
import { withdrawalSplit } from "@/lib/treasury-accounting";

// Called only after the Blockradar HMAC signature has been verified.
export async function handleWithdrawalWebhook(event: string, data: Record<string,unknown>, masterWalletId: string) {
  if (!["withdraw.success","withdraw.failed","withdraw.cancelled"].includes(event)) return "ignored";
  const reference = data.reference;
  if (typeof reference !== "string" || !/^zenvest-withdrawal:c[a-z0-9]{10,40}$/.test(reference)) return "unrelated";
  const id = reference.slice("zenvest-withdrawal:".length);
  const item = await prisma.investorWithdrawal.findUnique({where:{id},include:{treasury:true}});
  if (!item) return "unknown_withdrawal";
  if(!item.treasury || item.treasury.direction!=="WITHDRAWAL" || item.treasury.feeUsdcMicros!==item.feeUsdcMicros || item.treasury.amountUsdcMicros!==item.amountUsdcMicros)return "treasury_mismatch";
  const treasury=item.treasury;
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
    if (!item.treasuryId) throw new Error("Missing treasury transaction for payout");
    {
      const changedTreasury=await tx.treasuryTransfer.updateMany({
        where:{id:item.treasuryId,direction:"WITHDRAWAL",status:{in:["PROCESSING","REVIEW"]},
          masterWalletId,amountUsdcMicros:item.amountUsdcMicros,
          destinationWalletAddress:item.destinationAddress},
        data:{status:targetStatus==="SUCCESS"?"COMPLETE":"FAILED",
          originExternalId:transactionId,
          destinationExternalId:typeof data.hash==="string"?data.hash:null,
          ...(targetStatus==="SUCCESS"?{completedAt:new Date()}:{})},
      });
      if(changedTreasury.count!==1)throw new Error("Treasury settlement mismatch");
    }

    // Only verified payout success consumes the user balance; failed payouts release
    // their derived pending reservation by leaving the pending status set.
    if(targetStatus==="SUCCESS"){
      const changedUser=await tx.user.updateMany({
        where:{id:item.userId,unallocated:{gte:item.grossUsdcMicros}},
        data:{unallocated:{decrement:item.grossUsdcMicros}},
      });
      if(changedUser.count!==1)throw new Error("Insufficient unallocated funds at payout settlement");
      // Exactly one row per kind. A withdrawal decreases user-held master funds;
      // the retained service fee increases the fee bucket, not an outbound fee.
      const {gross:spent}=withdrawalSplit(item.grossUsdcMicros,item.amountUsdcMicros,treasury.feeUsdcMicros);
      const depositBucket=await tx.treasury.updateMany({
        where:{kind:"DEPOSIT",amount:{gte:spent}},
        data:{amount:{decrement:spent}},
      });
      if(depositBucket.count!==1)throw new Error("Insufficient treasury deposit balance");
      await tx.treasury.upsert({where:{kind:"WITHDRAWAL_FEE"},create:{
        walletAddress:treasury.masterWalletAddress,walletId:masterWalletId,
        asset:treasury.asset,network:treasury.network,source:"MASTER_WALLET",
        kind:"WITHDRAWAL_FEE",amount:treasury.feeUsdcMicros,
      },update:{amount:{increment:treasury.feeUsdcMicros}}});
      await tx.investorActivity.create({
        data:{userId:item.userId,type:"WITHDRAWAL_COMPLETED",amountKobo:0n,
          amountUsdcMicros:item.amountUsdcMicros,reference:`withdrawal:${id}:completed`,
          description:"Verified Solana USDC payout"},
      });
    }
    return true;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  journeyLog("info","withdrawal_settlement",result?event:"duplicate",{userId:item.userId,withdrawalId:id,providerTransactionId:transactionId});
  return result ? "settled" : "duplicate";
}
