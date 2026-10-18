import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { blockradarConfig } from "@/lib/blockradar";
import { handleWithdrawalWebhook } from "@/lib/withdrawal-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[a-f\d]{128}$/i.test(signature)) return false;
  const actual = Buffer.from(signature, "hex");
  const expected = createHmac("sha512", secret).update(body, "utf8").digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parseUsdcMicros(raw: unknown): bigint | null {
  if (typeof raw !== "string" || !/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const amount = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  return amount > 0n && amount <= 9223372036854775807n ? amount : null;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id") ?? crypto.randomUUID();
  const log = (outcome: string, status: number, extra: Record<string, string | boolean | number> = {}) =>
    console.info(JSON.stringify({ component: "blockradar-webhook", requestId, outcome, status, durationMs: Date.now() - startedAt, ...extra }));

  let apiKey: string, masterWalletId: string;
  try { const config = blockradarConfig(); apiKey = config.key; masterWalletId = config.walletId; }
  catch { log("unconfigured", 503); return NextResponse.json({ error: "Deposit processing unconfigured" }, { status: 503 }); }

  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-blockradar-signature"), apiKey)) {
    log("invalid_signature", 401);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { log("invalid_json", 400); return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!payload || typeof payload !== "object") { log("invalid_payload", 400); return NextResponse.json({ error: "Invalid payload" }, { status: 400 }); }
  const event = payload as { event?: unknown; data?: Record<string, unknown> };
  if (typeof event.event === "string" && ["withdraw.success","withdraw.failed","withdraw.cancelled"].includes(event.event)) {
    if (!event.data || typeof event.data !== "object") return NextResponse.json({error:"Missing withdrawal data"},{status:400});
    // Settle already submitted transfers even if new withdrawal requests are paused.
    try {
      const outcome = await handleWithdrawalWebhook(event.event,event.data,masterWalletId);
      log("withdrawal_"+outcome,200);
      return NextResponse.json({message:"success"},{status:200,headers:{"Cache-Control":"no-store"}});
    } catch(error) {
      console.error(JSON.stringify({component:"withdrawal-webhook",requestId,outcome:"processing_error",errorType:error instanceof Error?error.name:"unknown"}));
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
  const amount=parseUsdcMicros(data.amountPaid ?? data.amount);
  const isSwept=event.event==="deposit.swept.success";
  const sweepAmount=parseUsdcMicros(data.assetSweptAmount);
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
    log("unknown_address",422);
    return NextResponse.json({error:"Unrecognized deposit address"},{status:422});
  }
  // A signed sweep notification must prove that the *full deposit* moved
  // from the user's deposit address to the declared master wallet address.
  if (isSwept && (data.assetSwept!==true || !sweepAmount ||
      sweepAmount!==amount || typeof sweepHash!=="string" || !sweepHash ||
      data.assetSweptSenderAddress!==recipient ||
      typeof master.address!=="string" ||
      data.assetSweptRecipientAddress!==master.address)) {
    log("sweep_not_verified",422,{userId:wallet.userId,depositId:id});
    return NextResponse.json({error:"Sweep details do not match master wallet"},{status:422});
  }
  try {
    const outcome=await prisma.$transaction(async tx=>{
      let prior=await tx.blockchainDeposit.findUnique({where:{providerTransactionId:id}});
      if (prior && (prior.walletId!==wallet.id || prior.transactionHash!==hash ||
          prior.assetAddress!==mint || prior.amountUsdcMicros!==amount))
        throw new Error("Deposit identity mismatch");
      const portfolio=await tx.investorPortfolio.upsert({
        where:{userId:wallet.userId},create:{userId:wallet.userId},
        update:{},
      });
      if (!prior) {
        prior=await tx.blockchainDeposit.create({data:{
          walletId:wallet.id,providerTransactionId:id,transactionHash:hash,
          assetAddress:mint,amountUsdcMicros:amount,status:"CONFIRMING",
        }});
        await tx.investorPortfolio.update({where:{id:portfolio.id},
          data:{pendingDepositsUsdcMicros:{increment:amount}}});
      }
      if (!isSwept) return prior.status==="CONFIRMED" ? "already_confirmed" :
        event.event==="deposit.swept.failed" ? "sweep_failed" : "confirming";
      if (prior.status==="CONFIRMED") return "duplicate";
      const changed=await tx.blockchainDeposit.updateMany({
        where:{id:prior.id,status:"CONFIRMING"},
        data:{status:"CONFIRMED",sweepHash,creditedAt:new Date()},
      });
      if(changed.count!==1) return "duplicate";
      await tx.investorPortfolio.update({where:{id:portfolio.id},
        data:{pendingDepositsUsdcMicros:{decrement:amount},
          depositedUsdcMicros:{increment:amount},unallocatedUsdcMicros:{increment:amount}}});
      await tx.investorActivity.create({data:{
        portfolioId:portfolio.id,type:"DEPOSIT_CONFIRMED",amountKobo:0n,
        amountUsdcMicros:amount,reference:`blockradar:${id}`,
        description:"Confirmed Solana USDC deposit swept to master wallet",
      }});
      return "confirmed";
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    log(outcome,200,{userId:wallet.userId,depositId:id,transactionHash:hash});
    return NextResponse.json({message:"success"},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    console.error(JSON.stringify({component:"blockradar-webhook",requestId,
      outcome:"deposit_processing_failed",userId:wallet.userId,depositId:id,
      errorType:error instanceof Error?error.name:"unknown"}));
    // Let Blockradar retry on transaction races; no financial changes escape
    // the failed database transaction.
    return NextResponse.json({error:"Deposit processing unavailable"},{status:503});
  }

}
