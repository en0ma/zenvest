import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";
import {parsePositiveUsdcMicros} from "./blockradar-event-validation.ts";
import {platformWithdrawalReference} from "./blockradar-payout.ts";
import {withdrawalWebhookTarget} from "./transfer-lifecycle.ts";
/** Called ONLY by the HMAC-verified Blockradar webhook path. Funds are
 * reserved/decremented before submission; successful settlement never debits again.
 */
export async function handlePlatformWithdrawalWebhook(event:string,data:Record<string,unknown>,masterWalletId:string){
 if(!["withdraw.success","withdraw.failed","withdraw.cancelled"].includes(event))return "ignored";
 const reference=data.reference;
 if(typeof reference!=="string"||!/^platform_withdrawal:c[a-z0-9]{10,40}$/.test(reference))return "unrelated";
 const id=reference.slice("platform_withdrawal:".length);
 const record=await prisma.platformWithdrawal.findUnique({where:{id}});
 if(!record)return "not_found";
 const wallet=data.wallet&&typeof data.wallet==="object"?data.wallet as Record<string,unknown>:{};
 const asset=data.asset&&typeof data.asset==="object"?data.asset as Record<string,unknown>:{};
 const mint=process.env.BLOCKRADAR_SOLANA_USDC_MINT;
 const providerId=data.id;
 if(!mint||!providerId||typeof providerId!=="string"||
  wallet.id!==masterWalletId||data.type!=="WITHDRAW"||!["testnet","devnet"].includes(String(data.network))||
  asset.symbol!=="USDC"||asset.decimals!==6||
  (asset.address!==mint&&data.tokenAddress!==mint)||
  data.recipientAddress!==record.destinationAddress||
  parsePositiveUsdcMicros(data.amount)!==record.amountUsdcMicros||
  (record.providerTransactionId&&record.providerTransactionId!==providerId))return "mismatch";
 const target=withdrawalWebhookTarget(event,data.status);
 if(!target||(target==="COMPLETED"&&(data.confirmed===false||typeof data.hash!=="string"||!data.hash)))return "unconfirmed";
 return prisma.$transaction(async tx=>{
  const master=await tx.treasury.findUnique({where:{kind:"DEPOSIT"}});
  if(!master||master.walletId!==masterWalletId||master.source!=="MASTER_WALLET"||master.asset!=="USDC"||master.network!=="solana")
   throw Error("Master wallet identity changed");
  const updated=await tx.platformWithdrawal.updateMany({
   where:{id,status:{in:["SUBMITTING","PROCESSING","REVIEW"]}},
   data:{status:target,providerTransactionId:providerId,
    transactionHash:typeof data.hash==="string"?data.hash:record.transactionHash,
    ...(target==="COMPLETED"?{completedAt:new Date()}:{failureCode:event})}
  });
  if(updated.count!==1){
   if(target==="COMPLETED"&&record.status==="FAILED")return "late_success_review";
   return "duplicate";
  }
  if(target==="COMPLETED"){
   await tx.treasuryTransfer.create({data:{
    direction:"M_BANK_WITHDRAWAL",status:"COMPLETE",assetId:process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID,
    asset:"USDC",amountUsdcMicros:record.amountUsdcMicros,feeUsdcMicros:0n,
    destinationWalletAddress:record.destinationAddress,network:"solana",
    masterWalletAddress:master.walletAddress,masterWalletId,
    reference:platformWithdrawalReference(record.id),originExternalId:providerId,
    destinationExternalId:record.destinationAddress,completedAt:new Date()
   }});
  }else{
   // Only authenticated provider failure/cancellation releases reserved platform
   // funds. A timeout or ambiguous response holds them in REVIEW indefinitely.
   for(const [kind,amount] of [
    ["M_BANK",record.reservedMBankMicros],
    ["DEPOSIT_FEE",record.reservedDepositFeeMicros],
    ["WITHDRAWAL_FEE",record.reservedWithdrawalFeeMicros]
   ] as const){
    if(amount===0n)continue;
    const changed=await tx.treasury.updateMany({
     where:{kind,source:"MASTER_WALLET",walletId:masterWalletId},
     data:{amount:{increment:amount}}
    });
    if(changed.count!==1)throw Error("Platform treasury release failed");
   }
  }
  await tx.staffAudit.create({data:{actorId:"blockradar_webhook",action:"platform.withdrawal."+target.toLowerCase(),resource:"wallets",targetId:record.id}});
  return "settled";
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
