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
 const result=await prisma.$transaction(async tx=>{
  const changed=await tx.treasuryTransfer.updateMany({
   where:{id:transfer.id,direction:"ALLOCATE",status:{in:["PENDING","PROCESSING","REVIEW"]}},
   data:{status:status==="COMPLETED"?"COMPLETE":"FAILED",originExternalId:id,
    destinationExternalId:typeof data.hash==="string"?data.hash:null,
    ...(status==="COMPLETED"?{completedAt:new Date()}:{}),
   },
  });
  if(changed.count!==1)return "duplicate";
  const rows=await tx.positionAllocation.findMany({where:{treasuryId:transfer.id,status:{in:["SUBMITTING","PROCESSING","REVIEW"]}}});
  if(rows.length!==transfer.allocations.length||
   rows.reduce((n,r)=>n+r.amountUsdcMicros,0n)!==transfer.amountUsdcMicros)throw new Error("Allocation batch mismatched");
  const completed=await tx.positionAllocation.updateMany({
   where:{treasuryId:transfer.id,status:{in:["SUBMITTING","PROCESSING","REVIEW"]}},
   data:{status,completedAt:status==="COMPLETED"?new Date():null},
  });
  if(completed.count!==rows.length)throw new Error("Allocation rows changed");
  if(status==="COMPLETED"){
   const strategyId=transfer.allocations[0].position.strategyId;
   if(transfer.allocations.some(a=>a.position.strategyId!==strategyId))throw new Error("Batch mixes strategies");
   const capacity=await tx.strategy.updateMany({
    where:{id:strategyId,availableCapacityUsdcMicros:{gte:transfer.amountUsdcMicros}},
    data:{availableCapacityUsdcMicros:{decrement:transfer.amountUsdcMicros}},
   });
   if(capacity.count!==1)throw new Error("Insufficient remaining strategy capacity");
   // Exactly the principal sent is removed from each investor and added to their
   // strategy position; no fee retained for a strategy allocation.
   for(const row of rows){
    const debited=await tx.user.updateMany({where:{id:row.userId,unallocated:{gte:row.amountUsdcMicros}},
     data:{unallocated:{decrement:row.amountUsdcMicros}}});
    if(debited.count!==1)throw new Error("Insufficient investor balance");
    await tx.investorPosition.update({where:{id:row.positionId},
      data:{principalUsdcMicros:{increment:row.amountUsdcMicros},status:"ACTIVE"}});
    await tx.investorActivity.create({data:{
     userId:row.userId,type:"ALLOCATION",amountKobo:0n,
     amountUsdcMicros:row.amountUsdcMicros,reference:`allocation:${row.id}:completed`,
     description:"Verified strategy wallet USDC allocation",
    }});
   }
   const deposit=await tx.treasury.findUnique({where:{kind:"DEPOSIT"}});
   const deallocate=await tx.treasury.findUnique({where:{kind:"DEALLOCATE"}});
   if(!deposit||deposit.amount<0n||(deallocate&&deallocate.amount<0n))throw new Error("Missing master treasury funds");
   const fromDeposit=deposit.amount>=transfer.amountUsdcMicros?transfer.amountUsdcMicros:deposit.amount;
   const fromDeallocate=transfer.amountUsdcMicros-fromDeposit;
   if(fromDeallocate>(deallocate?.amount??0n))throw new Error("Insufficient custody balance");
   if(fromDeposit>0n){
    const changed=await tx.treasury.updateMany({where:{kind:"DEPOSIT",amount:{gte:fromDeposit}},data:{amount:{decrement:fromDeposit}}});
    if(changed.count!==1)throw new Error("Deposit bucket moved");
   }
   if(fromDeallocate>0n){
    const changed=await tx.treasury.updateMany({where:{kind:"DEALLOCATE",amount:{gte:fromDeallocate}},data:{amount:{decrement:fromDeallocate}}});
    if(changed.count!==1)throw new Error("Deallocate bucket moved");
   }
   await tx.treasury.update({where:{kind:"ALLOCATE"},data:{amount:{increment:transfer.amountUsdcMicros}}});
  }
  return "settled";
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 journeyLog("info","withdrawal_settlement",`allocation_${result}`,{providerTransactionId:id});
 return result;
}
