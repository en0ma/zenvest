import { timingSafeEqual } from "node:crypto";
import { journeyLog } from "@/lib/journey-log";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { blockradarConfig } from "@/lib/blockradar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Invoked by a trusted scheduler or operator, never from an investor browser.
// Resend requests reuse the existing signed webhook and idempotent ledger path.
export async function GET(request: Request) {
  const startedAt=Date.now();
  const requestId=request.headers.get("x-vercel-id")??crypto.randomUUID();
  const log=(outcome:string,extra:{userId?:string;depositId?:string;scanned?:number;missing?:number;replayRequested?:number;complete?:boolean}={})=>journeyLog(outcome==="unauthorized"||outcome==="webhook_replay_requested"?"warn":"info","deposit_reconciliation",outcome,{requestId,durationMs:Date.now()-startedAt,...extra});
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !supplied || Buffer.byteLength(secret) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) {
    log("unauthorized");
    return NextResponse.json({error:"Unauthorized"},{status:401});
  }
  if (process.env.BLOCKRADAR_DEPOSITS_ENABLED !== "true") {
    log("disabled");
    return NextResponse.json({error:"Deposit reconciliation disabled"},{status:503});
  }
  const mint = process.env.BLOCKRADAR_SOLANA_USDC_MINT;
  if (!mint) {log("missing_mint");return NextResponse.json({error:"USDC mint not configured"},{status:503});}
  let key: string, walletId: string;
  try { const config = blockradarConfig(); key=config.key; walletId=config.walletId; }
  catch {log("unconfigured");return NextResponse.json({error:"Blockradar not configured"},{status:503});}

  // A deliberately bounded scan. Further pages require the next scheduled run
  // or an operator-directed backfill; an incomplete response must not be mistaken
  // for a fully reconciled wallet.
  const pageSize = 100;
  let scanned=0, missing=0, replayRequested=0;
  let complete=false;
  try {
    for(let page=1;page<=5;page++) {
      const url=new URL(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(walletId)}/transactions`);
      url.searchParams.set("status","SUCCESS");
      url.searchParams.set("type","DEPOSIT");
      url.searchParams.set("limit",String(pageSize));
      url.searchParams.set("page",String(page));
      const response=await fetch(url,{headers:{"x-api-key":key},cache:"no-store",signal:AbortSignal.timeout(15000)});
      if(!response.ok) throw new Error(`Blockradar list HTTP ${response.status}`);
      const payload: unknown=await response.json();
      if(!payload || typeof payload!=="object" || !("data" in payload)) throw new Error("Malformed transaction list");
      const data=(payload as {data: unknown}).data;
      const items=Array.isArray(data) ? data : (data && typeof data==="object" && "transactions" in data && Array.isArray(data.transactions) ? data.transactions : null);
      if(!items) throw new Error("Unsupported transaction list shape");
      for(const item of items) {
        if(!item || typeof item!=="object") continue;
        const tx=item as Record<string,unknown>;
        if(tx.status!=="SUCCESS" || tx.type!=="DEPOSIT" || typeof tx.id!=="string") continue;
        const asset=tx.asset && typeof tx.asset==="object" ? tx.asset as Record<string,unknown> : {};
        if(asset.address!==mint || asset.symbol!=="USDC") continue;
        const target=typeof tx.recipientAddress==="string" ? tx.recipientAddress : null;
        if(!target) continue;
        const wallet=await prisma.investorDepositWallet.findFirst({where:{address:target,masterWalletId:walletId,status:"ACTIVE"},select:{id:true,userId:true}});
        if(!wallet) continue;
        scanned++;
        const already=await prisma.blockchainDeposit.findUnique({where:{providerTransactionId:tx.id},select:{id:true}});
        if(already) continue;
        missing++;
        const resend=await fetch(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(walletId)}/transactions/${encodeURIComponent(tx.id)}/resend-webhook`,{
          method:"POST",headers:{"x-api-key":key},cache:"no-store",signal:AbortSignal.timeout(15000)
        });
        if(!resend.ok) throw new Error(`Blockradar resend HTTP ${resend.status}`);
        replayRequested++;
        log("webhook_replay_requested",{userId:wallet.userId,depositId:tx.id});
      }
      if(items.length<pageSize){complete=true;break;}
    }
    log("scan_completed",{scanned,missing,replayRequested,complete});
    return NextResponse.json({scanned,missing,replayRequested,complete,note:complete?"Scanned all returned pages":"Page limit reached; further backfill required"});
  } catch(error) {
    journeyLog("error","deposit_reconciliation","scan_failed",{requestId,scanned,missing,replayRequested,errorType:error instanceof Error?error.name:"unknown",durationMs:Date.now()-startedAt});
    return NextResponse.json({error:"Reconciliation failed; retry required",scanned,missing,replayRequested,complete:false},{status:503});
  }
}
