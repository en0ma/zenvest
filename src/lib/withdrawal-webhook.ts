import { Prisma } from "@prisma/client";
import { journeyLog } from "./journey-log.ts";
import { prisma } from "./db.ts";
import { withdrawalSplit } from "./treasury-accounting.ts";
import {WITHDRAWAL_FEE_USDC_MICROS} from "./withdrawal-fee.ts";
import {withdrawalWebhookTarget} from "./transfer-lifecycle.ts";
import {withdrawalReference} from "./blockradar-payout.ts";

// Called only after the Blockradar HMAC signature has been verified.
export async function handleWithdrawalWebhook(event: string, data: Record<string,unknown>, masterWalletId: string, rawPayload?: Record<string,unknown>) {
  if (!["withdraw.success","withdraw.failed","withdraw.cancelled"].includes(event)) return "ignored";
  const reference = data.reference;
  if (typeof reference !== "string" || !/^withdrawal:c[a-z0-9]{10,40}$/.test(reference)) return "unrelated";
  const id = reference.slice("withdrawal:".length);
  const item = await prisma.withdrawal.findUnique({where:{id},include:{treasuryTransaction:true}});
  if (!item) return "unknown_withdrawal";
  if(item.feeUsdcMicros<WITHDRAWAL_FEE_USDC_MICROS || item.grossUsdcMicros!==item.amountUsdcMicros+item.feeUsdcMicros)return "withdrawal_mismatch";
  if(item.treasuryTransaction && (item.treasuryTransaction.reference!==withdrawalReference(id)||item.treasuryTransaction.direction!=="WITHDRAWAL"||item.treasuryTransaction.amountUsdcMicros!==item.amountUsdcMicros))return "treasury_mismatch";
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
  const targetStatus=withdrawalWebhookTarget(event,data.status);
  if (!targetStatus || (event==="withdraw.success" && (data.confirmed===false || typeof data.hash!=="string"))) return "unconfirmed";
  const result = await prisma.$transaction(async tx => {
    // Record a signed, verified success that arrives after a FAILED withdrawal.
    // The conditional settlement below cannot debit a FAILED withdrawal.
    const saveLateSuccess=async()=>{
      const row=await tx.withdrawal.findUnique({where:{id},select:{status:true}});
      if(event!=="withdraw.success" || row?.status!=="FAILED")return false;
      await tx.webhookDeadLater.createMany({data:[{
        kind:"withdrawal",userId:item.userId,reference:id,providerTransactionId:transactionId,
        payload:JSON.parse(JSON.stringify(rawPayload??{event,data})) as Prisma.InputJsonValue,
      }],skipDuplicates:true});
      return true;
    };
    if(await saveLateSuccess())return "dead_letter";
    // Conditional transition makes duplicate webhooks harmless.
    const updated = await tx.withdrawal.updateMany({
      where:{id,status:{in:["PROCESSING","SUBMITTING","REVIEW"]}},
      data:{status:targetStatus,providerTransactionId:transactionId,
        transactionHash:typeof data.hash === "string" ? data.hash : item.transactionHash,
        ...(targetStatus === "COMPLETED" ? {completedAt:new Date()} : {failureCode:event})},
    });
    if (updated.count !== 1) return await saveLateSuccess() ? "dead_letter" : "duplicate";
    // No ledger entry is minted on a failed/cancelled provider callback.
    // Authenticated SUCCESS alone may create a COMPLETE treasury transaction.
    if(targetStatus==="COMPLETED"){
      const existing=await tx.treasuryTransfer.findUnique({where:{reference:withdrawalReference(id)}});
      if(existing)throw new Error("Unexpected prior withdrawal ledger entry");
      const depositMaster=await tx.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
      if(depositMaster.walletId!==masterWalletId)throw new Error("Master wallet mismatch");
      const transfer=await tx.treasuryTransfer.create({data:{
        direction:"WITHDRAWAL",status:"COMPLETE",assetId:process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID,
        asset:"USDC",amountUsdcMicros:item.amountUsdcMicros,feeUsdcMicros:item.feeUsdcMicros,
        destinationWalletAddress:item.destinationAddress,network:"solana",
        masterWalletAddress:depositMaster.walletAddress,masterWalletId,
        reference:withdrawalReference(id),originExternalId:transactionId,
        destinationExternalId:item.destinationAddress,completedAt:new Date(),
      }});
      await tx.withdrawal.update({where:{id},data:{treasuryTransactionId:transfer.id}});
    }

    // Only verified payout success consumes the user balance; failed payouts release
    // their derived pending reservation by leaving the pending status set.
    if(targetStatus==="COMPLETED"){
      const changedUser=await tx.user.updateMany({
        where:{id:item.userId,unallocated:{gte:item.grossUsdcMicros}},
        data:{unallocated:{decrement:item.grossUsdcMicros}},
      });
      if(changedUser.count!==1)throw new Error("Insufficient unallocated funds at payout settlement");
      // Exactly one row per kind. A withdrawal decreases user-held master funds;
      // only the retained 2 USDC increases the fee bucket; network costs are not platform revenue.
      const {gross:spent}=withdrawalSplit(item.grossUsdcMicros,item.amountUsdcMicros,item.feeUsdcMicros);
      // Spend from master-held DEPOSIT then DEALLOCATE capital. The sum must
      // cover the gross debit and the whole split settles atomically.
      const deposit=await tx.treasury.findUnique({where:{kind:"DEPOSIT"}});
      const deallocate=await tx.treasury.findUnique({where:{kind:"DEALLOCATE"}});
      if(!deposit||deposit.amount<0n||(deallocate&&deallocate.amount<0n))
        throw new Error("Missing treasury funds");
      const fromDeposit=deposit.amount>=spent?spent:deposit.amount;
      const fromDeallocate=spent-fromDeposit;
      if(fromDeallocate>(deallocate?.amount??0n))throw new Error("Insufficient master treasury balance");
      if(fromDeposit>0n){
        const updated=await tx.treasury.updateMany({where:{kind:"DEPOSIT",amount:{gte:fromDeposit}},data:{amount:{decrement:fromDeposit}}});
        if(updated.count!==1)throw new Error("Deposit bucket changed");
      }
      if(fromDeallocate>0n){
        const updated=await tx.treasury.updateMany({where:{kind:"DEALLOCATE",amount:{gte:fromDeallocate}},data:{amount:{decrement:fromDeallocate}}});
        if(updated.count!==1)throw new Error("Deallocate bucket changed");
      }
      await tx.treasury.upsert({where:{kind:"WITHDRAWAL_FEE"},create:{
        walletAddress:(await tx.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}})).walletAddress,walletId:masterWalletId,
        asset:item.asset,network:"solana",source:"MASTER_WALLET",
        kind:"WITHDRAWAL_FEE",amount:WITHDRAWAL_FEE_USDC_MICROS,
      },update:{amount:{increment:WITHDRAWAL_FEE_USDC_MICROS}}});
      await tx.investorActivity.create({
        data:{userId:item.userId,type:"WITHDRAWAL_COMPLETED",amountKobo:0n,
          amountUsdcMicros:item.amountUsdcMicros,reference:`withdrawal:${id}:completed`,
          description:"Verified Solana USDC payout"},
      });
    }
    return "settled";
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  journeyLog("info","withdrawal_settlement",result==="settled"?event:result,{userId:item.userId,withdrawalId:id,providerTransactionId:transactionId});
  return result;
}
