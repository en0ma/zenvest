import { timingSafeEqual } from "node:crypto";
import { logJourney } from "@/lib/journey-logs";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { blockradarConfig } from "@/lib/blockradar";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const json=(body:object,status=200)=>NextResponse.json(body,{status});
function authorized(request:Request) {
  const secret=process.env.CRON_SECRET;
  const provided=request.headers.get("authorization")?.replace(/^Bearer /,"")??"";
  return Boolean(secret&&provided&&Buffer.byteLength(secret)===Buffer.byteLength(provided)&&timingSafeEqual(Buffer.from(secret!),Buffer.from(provided)));
}
export async function GET(request:Request) {
  const startedAt=Date.now();
  const requestId=request.headers.get("x-vercel-id")??crypto.randomUUID();
  const log=(level:"info"|"warn"|"error",outcome:string,details:{userId?:string;withdrawalId?:string;providerTransactionId?:string;errorType?:string}={})=>logJourney(level,"withdrawal_processing",outcome,{requestId,durationMs:Date.now()-startedAt,...details});
  if(!authorized(request)){log("warn","unauthorized");return json({error:"Unauthorized"},401);}
  if(process.env.BLOCKRADAR_WITHDRAWALS_ENABLED!=="true"){log("info","disabled");return json({status:"disabled"});}
  const assetId=process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID;
  if(!assetId){log("error","missing_asset");return json({error:"USDC asset missing"},503);}
  let key:string,walletId:string;
  try {const c=blockradarConfig();key=c.key;walletId=c.walletId;}
  catch{log("error","unconfigured");return json({error:"Wallet config unavailable"},503);}

  // Claim a single oldest pending payout. Serializable treasury row updates
  // prevent concurrent cron invocations from spending the same liquidity.
  let item:Awaited<ReturnType<typeof prisma.investorWithdrawal.findFirst>>=null;
  try {
    item=await prisma.$transaction(async tx=>{
      const candidates=await tx.investorWithdrawal.findMany({where:{status:"PENDING",deallocations:{none:{status:{in:["PENDING","PROCESSING","FAILED"]}}}},orderBy:[{createdAt:"asc"},{id:"asc"}],take:100});
      if(!candidates.length) return null;
      const liquidity=await tx.masterWalletBalance.findUnique({where:{walletId}});
      if(!liquidity) return null;
      const available=liquidity.confirmedUsdcMicros-liquidity.reservedUsdcMicros-liquidity.feeReserveUsdcMicros;
      const first=candidates.find(candidate=>candidate.amountUsdcMicros<=available);
      if(!first) return null;
      const claim=await tx.investorWithdrawal.updateMany({where:{id:first.id,status:"PENDING"},data:{status:"PROCESSING"}});
      if(claim.count!==1) return null;
      await tx.masterWalletBalance.update({where:{walletId},data:{reservedUsdcMicros:{increment:first.amountUsdcMicros}}});
      return first;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }catch(e){
    log("error","claim_error",{errorType:e instanceof Error?e.name:"unknown"});
    return json({error:"Queue claim failed"},503);
  }
  if(!item) return json({status:"idle_or_insufficient_master_liquidity"});
  const digits=item.amountUsdcMicros.toString().padStart(7,"0");
  const amount=digits.slice(0,-6)+"."+digits.slice(-6);
  const payload={assetId,address:item.destinationAddress,amount,reference:`zenvest-withdrawal:${item.id}`};
  try{
    // Failure before any broadcast is safe to requeue, but uncertain submissions
    // always enter REVIEW and retain their master-wallet liquidity reservation.
    const feeResponse=await fetch(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(walletId)}/withdraw/network-fee`,{
      method:"POST",headers:{"x-api-key":key,"Content-Type":"application/json"},
      body:JSON.stringify({assetId,address:item.destinationAddress,amount}),signal:AbortSignal.timeout(12000),cache:"no-store"});
    const rawFee:unknown=await feeResponse.json().catch(()=>null);
    const feeObj=rawFee&&typeof rawFee==="object"&&"data" in rawFee ? (rawFee as {data:unknown}).data : null;
    const fee=feeObj&&typeof feeObj==="object"?feeObj as Record<string,unknown>:{};
    if(!feeResponse.ok||typeof fee.networkFee!=="string"||typeof fee.nativeBalance!=="string"||
      !/^\d+(\.\d+)?$/.test(fee.networkFee)||!/^\d+(\.\d+)?$/.test(fee.nativeBalance)||
      Number(fee.nativeBalance)<Number(fee.networkFee)) {
      await prisma.$transaction(async tx=>{
        const u=await tx.investorWithdrawal.updateMany({where:{id:item!.id,status:"PROCESSING"},data:{status:"PENDING"}});
        if(u.count)await tx.masterWalletBalance.update({where:{walletId},data:{reservedUsdcMicros:{decrement:item!.amountUsdcMicros}}});
      });
      log("warn","awaiting_network_fee",{userId:item.userId,withdrawalId:item.id});
      return json({status:"awaiting_network_fee",withdrawalId:item.id});
    }
  }catch{
    // Fee estimation errors are pre-broadcast, safe to leave pending.
    await prisma.$transaction(async tx=>{
      const u=await tx.investorWithdrawal.updateMany({where:{id:item!.id,status:"PROCESSING"},data:{status:"PENDING"}});
      if(u.count)await tx.masterWalletBalance.update({where:{walletId},data:{reservedUsdcMicros:{decrement:item!.amountUsdcMicros}}});
    });
    log("warn","fee_estimation_unavailable",{userId:item.userId,withdrawalId:item.id});
    return json({status:"fee_estimation_unavailable"});
  }

  try{
    const response=await fetch(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(walletId)}/withdraw`,{
      method:"POST",headers:{"x-api-key":key,"Content-Type":"application/json"},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(20000),cache:"no-store"});
    const raw:unknown=await response.json().catch(()=>null);
    const data=raw&&typeof raw==="object"&&"data" in raw?(raw as {data:unknown}).data:null;
    const tx=data&&typeof data==="object"?data as Record<string,unknown>:{};
    if(!response.ok||typeof tx.id!=="string")throw Error("Uncertain outcome");
    await prisma.investorWithdrawal.updateMany({where:{id:item.id,status:"PROCESSING"},data:{
      providerTransactionId:tx.id,transactionHash:typeof tx.hash==="string"?tx.hash:null}});
    log("info","submitted",{userId:item.userId,withdrawalId:item.id,providerTransactionId:tx.id});
    return json({status:"processing",withdrawalId:item.id});
  }catch(e){
    await prisma.investorWithdrawal.updateMany({where:{id:item.id,status:"PROCESSING"},data:{status:"REVIEW",failureCode:"UNKNOWN_PROVIDER_OUTCOME"}});
    log("error","manual_reconciliation",{userId:item.userId,withdrawalId:item.id,errorType:e instanceof Error?e.name:"unknown"});
    return json({status:"review",withdrawalId:item.id});
  }
}
