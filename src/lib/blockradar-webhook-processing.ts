import {validBlockradarSignature,parsePositiveUsdcMicros,validSweptDeposit} from "@/lib/blockradar-event-validation";
import { journeyLog, type JourneyFields } from "@/lib/journey-log";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { blockradarConfig } from "@/lib/blockradar";
import { handleWithdrawalWebhook } from "@/lib/withdrawal-webhook";
import {handleAllocationWebhook} from "@/lib/allocation-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function processVerifiedBlockradarQueueItem(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id") ?? crypto.randomUUID();
  const log = (outcome: string, status: number, extra: JourneyFields = {}) =>
    journeyLog(status>=500?"error":status>=400||outcome==="sweep_failed"?"warn":"info","deposit_webhook",outcome,{requestId,status,durationMs:Date.now()-startedAt,...extra});

  let apiKey: string, masterWalletId: string;
  try { const config = blockradarConfig(); apiKey = config.key; masterWalletId = config.walletId; }
  catch { log("unconfigured", 503); return NextResponse.json({ error: "Deposit processing unconfigured" }, { status: 503 }); }

  const raw = await request.text();
  if (!validBlockradarSignature(raw, request.headers.get("x-blockradar-signature"), apiKey)) {
    log("invalid_signature", 401);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { log("invalid_json", 400); return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!payload || typeof payload !== "object") { log("invalid_payload", 400); return NextResponse.json({ error: "Invalid payload" }, { status: 400 }); }
  const event = payload as { event?: unknown; data?: Record<string, unknown> };
  if (typeof event.event === "string" && ["withdraw.success","withdraw.failed","withdraw.cancelled"].includes(event.event)) {
    if (!event.data || typeof event.data !== "object") return NextResponse.json({error:"Missing withdrawal data"},{status:400});
    // Settle allocations and withdrawals even if incoming requests are disabled.
    try {
      if(typeof event.data.reference==="string" && event.data.reference.startsWith("strategy_withdrawal:")){
       const outcome=await handleAllocationWebhook(event.event,event.data,masterWalletId);
       log("allocation_"+outcome,200);
       return NextResponse.json({message:"success"},{status:200,headers:{"Cache-Control":"no-store"}});
      }
      const outcome = await handleWithdrawalWebhook(event.event,event.data,masterWalletId,payload as Record<string,unknown>);
      log("withdrawal_"+outcome,200);
      return NextResponse.json({message:"success"},{status:200,headers:{"Cache-Control":"no-store"}});
    } catch(error) {
      journeyLog("error","withdrawal_settlement","processing_error",{requestId,errorType:error instanceof Error?error.name:"unknown",durationMs:Date.now()-startedAt});
      return NextResponse.json({error:"Withdrawal processing unavailable"},{status:503});
    }
  }
  if (process.env.BLOCKRADAR_DEPOSITS_ENABLED !== "true") {
    log("deposit_processing_disabled", 503);
    return NextResponse.json({ error: "Deposit processing disabled" }, { status: 503 });
  }

  if (!["deposit.success","deposit.swept.success","deposit.swept.failed"].includes(String(event.event))) {
    log("ignored_event", 200);
    return NextResponse.json({message:"success"});
  }
  const data = event.data;
  if (!data || typeof data !== "object") return NextResponse.json({error:"Missing deposit data"},{status:400});
  const asset = data.asset && typeof data.asset === "object" ? data.asset as Record<string,unknown> : {};
  const addr = data.address && typeof data.address === "object" ? data.address as Record<string,unknown> : {};
  const master = data.wallet && typeof data.wallet === "object" ? data.wallet as Record<string,unknown> : {};
  const mint=process.env.BLOCKRADAR_SOLANA_USDC_MINT;
  if (!mint) return NextResponse.json({error:"USDC mint not configured"},{status:503});
  const id=data.id, recipient=data.recipientAddress, hash=data.hash;
  const amount=parsePositiveUsdcMicros(data.amountPaid ?? data.amount);
  // A failed sweep is an operational warning, never a reason to release funds.
  // Preserve any existing CONFIRMING record and let later success finalize it.
  if (event.event==="deposit.swept.failed") {
    log("sweep_failed",200,{depositId:typeof id==="string"?id:"unknown"});
    return NextResponse.json({message:"success"});
  }
  const isSwept=event.event==="deposit.swept.success";
  const sweepAmount=parsePositiveUsdcMicros(data.assetSweptAmount);
  const sweepHash=data.assetSweptHash;
  if (data.confirmed!==true || data.status!=="SUCCESS" || data.type!=="DEPOSIT" ||
      asset.symbol!=="USDC" || asset.address!==mint || asset.decimals!==6 ||
      typeof id!=="string" || typeof recipient!=="string" || typeof hash!=="string" ||
      !amount || !["devnet","testnet"].includes(String(data.network)) ||
      (addr.address && addr.address!==recipient) || master.id!==masterWalletId) {
    log("deposit_not_eligible",200);
    return NextResponse.json({message:"success"});
  }
  const wallet=await prisma.investorDepositWallet.findUnique({where:{address:recipient}});
  if (!wallet || wallet.status!=="ACTIVE" || wallet.masterWalletId!==masterWalletId ||
      (addr.id && addr.id!==wallet.addressId)) {
    log("unknown_address",422,{depositId:typeof id==="string"?id:"unknown",...(wallet?{userId:wallet.userId}:{})});
    return NextResponse.json({error:"Unrecognized deposit address"},{status:422});
  }
  // A signed sweep notification must prove that the *full deposit* moved
  // from the user's deposit address to the declared master wallet address.
  if (isSwept && !validSweptDeposit(data,mint,masterWalletId,recipient,amount)) {
    log("sweep_not_verified",422,{userId:wallet.userId,depositId:id});
    return NextResponse.json({error:"Sweep details do not match master wallet"},{status:422});
  }
  try {
    const outcome=await prisma.$transaction(async tx=>{
      let prior=await tx.blockchainDeposit.findUnique({where:{providerTransactionId:id}});
      if (prior && (prior.walletId!==wallet.id || prior.transactionHash!==hash ||
          prior.assetAddress!==mint || prior.amountUsdcMicros!==amount))
        throw new Error("Deposit identity mismatch");
      if (!prior) {
        prior=await tx.blockchainDeposit.create({data:{
          walletId:wallet.id,providerTransactionId:id,transactionHash:hash,
          assetAddress:mint,amountUsdcMicros:amount,status:"CONFIRMING",
        }});
      }
      if (!isSwept) return prior.status==="CONFIRMED" ? "already_confirmed" :
        "confirming";
      if (prior.status==="CONFIRMED") return "duplicate";
      const changed=await tx.blockchainDeposit.updateMany({
        where:{id:prior.id,status:"CONFIRMING"},
        data:{status:"CONFIRMED",sweepHash:sweepHash as string,creditedAt:new Date()},
      });
      if(changed.count!==1) return "duplicate";
      // Record custody movement atomically with the confirmed investor deposit.
      // The conditional CONFIRMING -> CONFIRMED transition is the idempotency gate.
      const treasuryTransaction=await tx.treasuryTransfer.create({data:{
        direction:"DEPOSIT",status:"COMPLETE",
        assetId:mint,asset:"USDC",amountUsdcMicros:amount,feeUsdcMicros:0n,
        destinationWalletAddress:master.address as string,
        network:"solana",masterWalletAddress:master.address as string,
        masterWalletId,originExternalId:recipient,
        destinationExternalId:master.address as string,
        reference:id,completedAt:new Date(),
      }});
      await tx.blockchainDeposit.update({where:{id:prior.id},data:{treasuryTransactionId:treasuryTransaction.id}});

      await tx.user.update({where:{id:wallet.userId},data:{unallocated:{increment:amount}}});
      await tx.treasury.upsert({where:{kind:"DEPOSIT"},create:{walletAddress:master.address as string,walletId:masterWalletId,asset:"USDC",network:"solana",source:"MASTER_WALLET",kind:"DEPOSIT",amount},update:{amount:{increment:amount}}});
      await tx.investorActivity.create({data:{
        userId:wallet.userId,type:"DEPOSIT_CONFIRMED",amountKobo:0n,
        amountUsdcMicros:amount,reference:`blockradar:${id}`,
        description:"Confirmed Solana USDC deposit swept to master wallet",
      }});
      return "confirmed";
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    log(outcome,200,{userId:wallet.userId,depositId:id,transactionHash:hash});
    return NextResponse.json({message:"success"},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    journeyLog("error","deposit_webhook","deposit_processing_failed",{requestId,userId:wallet.userId,depositId:id,errorType:error instanceof Error?error.name:"unknown",durationMs:Date.now()-startedAt});
    // Let Blockradar retry on transaction races; no financial changes escape
    // the failed database transaction.
    return NextResponse.json({error:"Deposit processing unavailable"},{status:503});
  }

}
