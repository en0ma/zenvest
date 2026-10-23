import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";
import {withdrawalWebhookTarget} from "./transfer-lifecycle.ts";
import {journeyLog} from "./journey-log.ts";

// Called only after the HMAC check in the Blockradar webhook route.
export async function handleAllocationWebhook(event:string,data:Record<string,unknown>,masterWalletId:string){
 if(!["withdraw.success","withdraw.failed","withdraw.cancelled"].includes(event))return "ignored";
 const reference=data.reference;
 if(typeof reference!=="string"||!/^allocation:[0-9a-f-]{36}$/.test(reference))return "unrelated";
 const transfer=await prisma.treasuryTransfer.findUnique({where:{reference},include:{allocations:{include:{position:true}}}});
 if(!transfer||transfer.direction!=="ALLOCATE"||transfer.masterWalletId!==masterWalletId||transfer.allocations.length===0)return "unrelated";
 const asset=data.asset&&typeof data.asset==="object"?data.asset as Record<string,unknown>:{};
 const wallet=data.wallet&&typeof data.wallet==="object"?data.wallet as Record<string,unknown>:{};
 const mint=process.env.BLOCKRADAR_SOLANA_USDC_MINT;
 const id=data.id;
 const amountStr=data.amount;
 const amount=typeof amountStr==="string"&&/^\d+(\.\d{1,6})?$/.test(amountStr)?
  BigInt(amountStr.split(".")[0])*1000000n+BigInt((amountStr.split(".")[1]??"").padEnd(6,"0")):null;
 if(!mint||typeof id!=="string"||!id||wallet.id!==masterWalletId||data.type!=="WITHDRAW"||
  !["devnet","testnet"].includes(String(data.network))||asset.symbol!=="USDC"||asset.decimals!==6||
  (asset.address!==mint&&data.tokenAddress!==mint)||
  data.recipientAddress!==transfer.destinationWalletAddress||
  amount!==transfer.amountUsdcMicros||
  (transfer.originExternalId&&transfer.originExternalId!==id))return "mismatch";
 const status=withdrawalWebhookTarget(event,data.status);
 if(!status||(status==="COMPLETED"&&(data.confirmed===false||typeof data.hash!=="string")))return "unconfirmed";
 // An authenticated outbound Blockradar withdrawal is NOT evidence of a
 // credit to Kalshi. Preserve transfer identity and the investor reservation.
 // A separate authenticated Kalshi receipt integration must settle principal.
 if(status==="COMPLETED"){
  const outcome=await prisma.$transaction(async tx=>{
   const current=await tx.treasuryTransfer.findUnique({where:{id:transfer.id}});
   if(!current||current.status==="FAILED"||current.status==="COMPLETE")return "requires_reconciliation";
   if(current.originExternalId&&current.originExternalId!==id)return "mismatch";
   const updated=await tx.treasuryTransfer.updateMany({
    where:{id:transfer.id,direction:"ALLOCATE",status:{in:["PENDING","PROCESSING","REVIEW"]},
     OR:[{originExternalId:null},{originExternalId:id}]},
    data:{status:"PROCESSING",originExternalId:id,destinationExternalId:data.hash as string},
   });
   if(updated.count!==1)return "duplicate";
   await tx.positionAllocation.updateMany({
    where:{treasuryId:transfer.id,kind:"ALLOCATE",status:{in:["SUBMITTING","PROCESSING","REVIEW"]}},
    data:{status:"CONFIRMING"},
   });
   return "awaiting_kalshi_receipt";
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  journeyLog("info","withdrawal_settlement",`allocation_${outcome}`,{providerTransactionId:id});
  return outcome;
 }
 // Once an authenticated outbound success has advanced the batch to
 // CONFIRMING, a conflicting failure event cannot release reserved funds.
 if(transfer.allocations.some(a=>a.status==="CONFIRMING"))return "requires_reconciliation";
 const result=await prisma.$transaction(async tx=>{
  const confirming=await tx.positionAllocation.count({where:{treasuryId:transfer.id,kind:"ALLOCATE",status:"CONFIRMING"}});
  if(confirming>0)return "requires_reconciliation";
  const changed=await tx.treasuryTransfer.updateMany({
   where:{id:transfer.id,direction:"ALLOCATE",status:{in:["PENDING","PROCESSING","REVIEW"]}},
   data:{status:"FAILED",originExternalId:id,destinationExternalId:typeof data.hash==="string"?data.hash:null},
  });
  if(changed.count!==1)return "duplicate";
  const count=await tx.positionAllocation.updateMany({
   where:{treasuryId:transfer.id,status:{in:["SUBMITTING","PROCESSING","REVIEW"]}},
   data:{status:"FAILED"},
  });
  if(count.count!==transfer.allocations.length)throw new Error("Allocation batch changed during failure transition");
  return "settled";
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 journeyLog("info","withdrawal_settlement",`allocation_${result}`,{providerTransactionId:id});
 return result;
}
