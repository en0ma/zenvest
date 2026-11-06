import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {blockradarConfig} from "@/lib/blockradar";
import {validateAdminWalletTransfer,planAdminWalletFunding,MASTER_WALLET_SPEND_KINDS} from "@/lib/staff-wallet-policy";
import {requireStaffPermission} from "@/lib/staff-access";
import {staffWriteError} from "@/lib/staff-write-error";
import {isApprovedActionAuthorized} from "@/lib/staff-approval-policy";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Reserve platform-only treasury and persist a payout without contacting custody.
 * PENDING is a durable, recoverable work item; approval is consumed only once.
 */
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const actor=await requireStaffPermission("wallets:operate",{requireFreshLogin:true});
  // Remain disabled in all deployments until settlement tests and rollout review.
  if(process.env.STAFF_PLATFORM_WITHDRAWALS_ENABLED!=="true")
   return Response.json({error:"Platform wallet transfers are disabled"},{status:503});
  const {id}=await params;
  const {walletId}=blockradarConfig();
  const action=await prisma.staffAction.findUnique({where:{id}});
  if(!action||action.resource!=="wallets"||action.operation!=="operate")
   return Response.json({error:"Wallet action not found"},{status:404});
  if(action.status!=="APPROVED"||!action.decidedBy)
   return Response.json({error:"Action authorization required"},{status:409});
  const validated=validateAdminWalletTransfer(action.payload);
  if(!validated.ok||validated.payload.kind!=="MASTER_TO_WALLET"||!validated.payload.destinationAddress)
   return Response.json({error:"Unsupported platform wallet transfer"},{status:422});
  const amount=BigInt(validated.payload.amountUsdcMicros);
  const reserved=await prisma.$transaction(async tx=>{
   // Self-approval is exceptional and remains valid only while the maker
   // still holds the canonical Super Admin role at execution time.
   const superAdmin=action.requestedBy===action.decidedBy?
    await tx.userRole.findFirst({where:{userId:action.requestedBy,role:{key:"super-admin"}},select:{userId:true}}):null;
   if(!isApprovedActionAuthorized(action,Boolean(superAdmin)))return null;
   const master=await tx.treasury.findUnique({where:{kind:"DEPOSIT"}});
   if(!master||master.id!==action.targetId||master.walletId!==walletId||master.source!=="MASTER_WALLET"||master.asset!=="USDC"||master.network!=="solana")return null;
   const rows=await tx.treasury.findMany({where:{kind:{in:[...MASTER_WALLET_SPEND_KINDS,"K_BANK"]}}});
   const values={M_BANK:0n,DEPOSIT_FEE:0n,WITHDRAWAL_FEE:0n,K_BANK:0n};
   for(const row of rows){
    if(row.kind in values){
     if(row.amount<0n)return null;
     if(row.kind!=="K_BANK"&&(row.source!=="MASTER_WALLET"||row.walletId!==walletId||row.network!=="solana"||row.asset!=="USDC"))return null;
     values[row.kind as keyof typeof values]=row.amount;
    }
   }
   const plan=planAdminWalletFunding("MASTER_TO_WALLET",amount,values);
   if(!plan.ok)return null;
   // Conditional bucket decrements are the persistent reservation, preventing
   // a second claim from borrowing any part of this platform payout.
   for(const kind of MASTER_WALLET_SPEND_KINDS){
    const value=plan.debits[kind];
    if(value===0n)continue;
    const updated=await tx.treasury.updateMany({where:{kind,source:"MASTER_WALLET",walletId,amount:{gte:value}},data:{amount:{decrement:value}}});
    if(updated.count!==1)throw Error("Platform treasury changed during reservation");
   }
   const claimed=await tx.staffAction.updateMany({where:{id,status:"APPROVED",decidedBy:action.decidedBy,requestedBy:action.requestedBy,resource:"wallets",operation:"operate"},data:{status:"EXECUTED"}});
   if(claimed.count!==1)throw Error("Approval already consumed");
   const item=await tx.platformWithdrawal.create({data:{
    staffActionId:id,destinationAddress:validated.payload.destinationAddress!,amountUsdcMicros:amount,
    reservedMBankMicros:plan.debits.M_BANK,reservedDepositFeeMicros:plan.debits.DEPOSIT_FEE,reservedWithdrawalFeeMicros:plan.debits.WITHDRAWAL_FEE
   }});
   await tx.staffAudit.create({data:{actorId:actor,action:"platform.withdrawal.reserved",resource:"wallets",targetId:item.id}});
   return item.id;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(!reserved)return Response.json({error:"Not enough verified available platform treasury or master identity mismatch"},{status:409});
  return Response.json({id:reserved,status:"PENDING",execution:"RESERVED_NOT_SENT"},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(error){
  if(error&&typeof error==="object"&&"code" in error&&error.code==="P2034")
   return Response.json({error:"Concurrent treasury reservation; retry after review"},{status:409});
  if(error&&typeof error==="object"&&"code" in error&&error.code==="P2002")
   return Response.json({error:"Approval already reserved"},{status:409});
  return staffWriteError(error);
 }
}
