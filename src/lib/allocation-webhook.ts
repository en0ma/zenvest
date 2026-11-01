import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";
import {withdrawalWebhookTarget} from "./transfer-lifecycle.ts";

// Invoked exclusively after the Blockradar route validates its raw-body HMAC.
// The Kalshi destination confirmation is a separate authenticated event.
export async function handleAllocationWebhook(event:string,data:Record<string,unknown>,masterWalletId:string){
 if(!["withdraw.success","withdraw.failed","withdraw.cancelled"].includes(event))return "ignored";
 const reference=data.reference;
 if(typeof reference!=="string"||!/^strategy_withdrawal:c[a-z0-9]{10,40}$/.test(reference))return "unrelated";
 const eventId=reference.slice("strategy_withdrawal:".length);
 const batch=await prisma.strategyEvent.findUnique({where:{id:eventId},include:{strategy:true,positionEvents:true,treasuryTransaction:true}});
 if(!batch||batch.kind!=="ALLOCATE"||!batch.positionEvents.length)return "unrelated";
 const asset=data.asset&&typeof data.asset==="object"?data.asset as Record<string,unknown>:{};
 const wallet=data.wallet&&typeof data.wallet==="object"?data.wallet as Record<string,unknown>:{};
 const mint=process.env.BLOCKRADAR_SOLANA_USDC_MINT;
 const transactionId=data.id;
 const raw=data.amount;
 const amount=typeof raw==="string"&&/^\d+(\.\d{1,6})?$/.test(raw)?
  BigInt(raw.split(".")[0])*1000000n+BigInt((raw.split(".")[1]??"").padEnd(6,"0")):null;
 const destination=batch.strategy.kalshiWalletAddress;
 if(!mint||!destination||typeof transactionId!=="string"||!transactionId||
  wallet.id!==masterWalletId||data.type!=="WITHDRAW"||
  !["devnet","testnet"].includes(String(data.network))||
  asset.symbol!=="USDC"||asset.decimals!==6||
  (asset.address!==mint&&data.tokenAddress!==mint)||
  data.recipientAddress!==destination||amount!==batch.amountUsdcMicros||
  batch.positionEvents.some(x=>x.kind!=="ALLOCATE"||x.strategyId!==batch.strategyId)||
  batch.positionEvents.reduce((n,x)=>n+x.amountUsdcMicros,0n)!==batch.amountUsdcMicros||
  (batch.treasuryTransaction?.originExternalId&&batch.treasuryTransaction.originExternalId!==transactionId))
  return "mismatch";
 const status=withdrawalWebhookTarget(event,data.status);
 if(!status||(status==="COMPLETED"&&(data.confirmed===false||typeof data.hash!=="string")))return "unconfirmed";
 if(status!=="COMPLETED"){
  // The three-valued strategy-event status enum deliberately cannot express
  // terminal failure. Keep the hold pending explicit exception reconciliation.
  return "requires_reconciliation";
 }
 return prisma.$transaction(async tx=>{
  const current=await tx.strategyEvent.findUnique({where:{id:eventId}});
  if(!current)return "unrelated";
  if(current.sourceConfirmed)return "duplicate";
  const changed=await tx.strategyEvent.updateMany({
   where:{id:eventId,kind:"ALLOCATE",status:"PROCESSING",sourceConfirmed:false,treasuryTransactionId:null},
   data:{sourceConfirmed:true,status:"CONFIRMING"},
  });
  if(changed.count!==1)return "duplicate";
  const rows=await tx.positionAllocation.findMany({where:{strategyEventId:eventId,kind:"ALLOCATE"}});
  if(rows.length!==batch.positionEvents.length||
   rows.reduce((n,x)=>n+x.amountUsdcMicros,0n)!==batch.amountUsdcMicros)
   throw new Error("Strategy batch changed during source settlement");
  const owners=await tx.investorPosition.findMany({where:{id:{in:rows.map(r=>r.positionId)}},select:{id:true,userId:true,strategyId:true,status:true}});
  const ownerById=new Map(owners.map(p=>[p.id,p]));
  if(rows.some(r=>{
   const p=ownerById.get(r.positionId);
   return !p||p.userId!==r.userId||p.strategyId!==r.strategyId||
    p.strategyId!==batch.strategyId||p.status!=="OPEN"||r.amountUsdcMicros<=0n;
  }))throw new Error("Allocation source event position mismatch");
  const marked=await tx.positionAllocation.updateMany({
   where:{strategyEventId:eventId,kind:"ALLOCATE",status:{in:["SUBMITTING","PROCESSING","REVIEW"]}},
   data:{status:"CONFIRMING"},
  });
  if(marked.count!==rows.length)throw new Error("Strategy batch statuses changed");
  const master=await tx.treasury.findUnique({where:{kind:"DEPOSIT"}});
  if(!master||master.walletId!==masterWalletId||master.amount<batch.amountUsdcMicros)
   throw new Error("Insufficient master deposit treasury");
  const reduced=await tx.treasury.updateMany({
   where:{kind:"DEPOSIT",walletId:masterWalletId,amount:{gte:batch.amountUsdcMicros}},
   data:{amount:{decrement:batch.amountUsdcMicros}},
  });
  if(reduced.count!==1)throw new Error("Source treasury race");
  const transfer=await tx.treasuryTransfer.create({data:{
   direction:"ALLOCATE",status:"PROCESSING",asset:"USDC",
   assetId:process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID,
   amountUsdcMicros:batch.amountUsdcMicros,feeUsdcMicros:0n,
   destinationWalletAddress:destination,masterWalletAddress:master.walletAddress,
   masterWalletId,network:"solana",originExternalId:transactionId,
   reference,
  }});
  await tx.strategyEvent.update({where:{id:eventId},data:{treasuryTransactionId:transfer.id}});
  return "awaiting_kalshi_receipt";
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
