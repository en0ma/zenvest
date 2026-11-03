import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {blockradarConfig} from "@/lib/blockradar";
import {requireStaffPermission} from "@/lib/staff-access";
import {staffWriteError} from "@/lib/staff-write-error";
import {validateAdminWalletTransfer,resolveKalshiReturnDestination} from "@/lib/staff-wallet-policy";
import {submitMockKalshiWithdrawal} from "@/lib/kalshi-withdrawal-mock";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Admin K_BANK -> M_BANK withdrawal using the same currently mocked Kalshi adapter
 * as investor deallocation. HTTP 200 moves to PROCESSING only; confirmed custody
 * and eventual ledger settlement are separate from submission.
 */
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const actor=await requireStaffPermission("wallets:operate",{requireFreshLogin:true});
  if(process.env.STAFF_KALSHI_WITHDRAWALS_ENABLED!=="true")
   return Response.json({error:"Kalshi withdrawals disabled"},{status:503});
  const {id}=await params;
  const action=await prisma.staffAction.findUnique({where:{id}});
  if(!action||action.resource!=="wallets"||action.operation!=="operate")
   return Response.json({error:"Wallet action not found"},{status:404});
  if(action.status!=="APPROVED"||!action.decidedBy||action.decidedBy===action.requestedBy)
   return Response.json({error:"Independent approval required"},{status:409});
  const check=validateAdminWalletTransfer(action.payload,process.env.STAFF_WALLET_TRANSFER_LIMIT_MICROS);
  if(!check.ok||check.payload.kind!=="KALSHI_TO_MASTER")
   return Response.json({error:"Invalid Kalshi withdrawal"},{status:422});
  const {walletId}=blockradarConfig();
  const amount=BigInt(check.payload.amountUsdcMicros);
  const claimed=await prisma.$transaction(async tx=>{
   const [master,strategy,bank]=await Promise.all([
    tx.treasury.findUnique({where:{kind:"DEPOSIT"}}),
    tx.strategy.findUnique({where:{id:action.targetId}}),
    tx.treasury.findUnique({where:{kind:"K_BANK"}})
   ]);
   if(!master||!strategy||!strategy.kalshiWalletAddress||!bank||bank.source!=="KALSHI"||
      bank.asset!=="USDC"||bank.amount<amount)return null;
   const destination=resolveKalshiReturnDestination(master,walletId);
   if(!destination)return null;
   const changed=await tx.staffAction.updateMany({where:{
    id,status:"APPROVED",resource:"wallets",operation:"operate",
    requestedBy:{not:action.decidedBy!},decidedBy:action.decidedBy!
   },data:{status:"EXECUTED"}});
   if(changed.count!==1)return null;
   const row=await tx.staffKalshiWithdrawal.create({data:{
    staffActionId:id,strategyId:strategy.id,amountUsdcMicros:amount,
    masterWalletAddress:destination,status:"SUBMITTING"
   }});
   await tx.staffAudit.create({data:{actorId:actor,action:"kalshi.withdrawal.claimed",
    resource:"wallets",targetId:row.id}});
   return row;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(!claimed)return Response.json({error:"Approval consumed, invalid custody, or insufficient K_BANK for withdrawal"},{status:409});
  // Same currently mocked withdrawal submission as investor deallocation.
  // HTTP 200 means accepted for PROCESSING, not confirmed or settled.
  try{
   const result=await submitMockKalshiWithdrawal({
    eventId:claimed.id,amountUsdcMicros:claimed.amountUsdcMicros,
    destination:claimed.masterWalletAddress
   });
   if(result.status!==200||result.mocked!==true||!result.withdrawalId)
    throw Error("Invalid Kalshi withdrawal response");
   await prisma.$transaction(async tx=>{
    const updated=await tx.staffKalshiWithdrawal.updateMany({where:{
     id:claimed.id,status:"SUBMITTING"
    },data:{status:"PROCESSING",providerWithdrawalId:result.withdrawalId}});
    if(updated.count!==1)throw Error("Kalshi withdrawal state changed");
    await tx.staffAudit.create({data:{actorId:actor,action:"kalshi.withdrawal.processing",
     resource:"wallets",targetId:claimed.id}});
   });
   return Response.json({id:claimed.id,status:"PROCESSING",providerMode:"MOCK",
    execution:"ACCEPTED_PROCESSING",destination:"CONFIGURED_MASTER_WALLET",
    settled:false},{headers:{"Cache-Control":"no-store"}});
  }catch{
   await prisma.staffKalshiWithdrawal.updateMany({where:{id:claimed.id,status:"SUBMITTING"},
    data:{status:"REVIEW"}});
   return Response.json({id:claimed.id,status:"REVIEW",simulated:true,
    execution:"WITHDRAWAL_OUTCOME_REQUIRES_REVIEW"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
 }catch(error){
  if(error&&typeof error==="object"&&"code" in error&&error.code==="P2034")
   return Response.json({error:"Concurrent withdrawal claim; retry after review"},{status:409});
  if(error&&typeof error==="object"&&"code" in error&&error.code==="P2002")
   return Response.json({error:"Withdrawal already claimed"},{status:409});
  return staffWriteError(error);
 }
}
