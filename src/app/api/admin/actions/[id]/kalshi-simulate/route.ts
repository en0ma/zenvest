import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {blockradarConfig} from "@/lib/blockradar";
import {requireStaffPermission} from "@/lib/staff-access";
import {staffWriteError} from "@/lib/staff-write-error";
import {validateAdminWalletTransfer,resolveKalshiReturnDestination} from "@/lib/staff-wallet-policy";
import {submitMockKalshiWithdrawal} from "@/lib/kalshi-withdrawal-mock";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Simulation-only admin K_BANK -> M_BANK instruction. No on-chain submission,
 * no treasury debit/credit, no investor mutation and no real Kalshi withdrawal.
 */
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const actor=await requireStaffPermission("wallets:operate",{requireFreshLogin:true});
  if(process.env.STAFF_KALSHI_SIMULATION_ENABLED!=="true")
   return Response.json({error:"Kalshi simulation disabled"},{status:503});
  const {id}=await params;
  const action=await prisma.staffAction.findUnique({where:{id}});
  if(!action||action.resource!=="wallets"||action.operation!=="operate")
   return Response.json({error:"Wallet action not found"},{status:404});
  if(action.status!=="APPROVED"||!action.decidedBy||action.decidedBy===action.requestedBy)
   return Response.json({error:"Independent approval required"},{status:409});
  const check=validateAdminWalletTransfer(action.payload,process.env.STAFF_WALLET_TRANSFER_LIMIT_MICROS);
  if(!check.ok||check.payload.kind!=="KALSHI_TO_MASTER")
   return Response.json({error:"Invalid simulated Kalshi return"},{status:422});
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
   const row=await tx.staffKalshiReturnSimulation.create({data:{
    staffActionId:id,strategyId:strategy.id,amountUsdcMicros:amount,
    masterWalletAddress:destination,status:"CLAIMED"
   }});
   await tx.staffAudit.create({data:{actorId:actor,action:"kalshi.return.simulation.claimed",
    resource:"wallets",targetId:row.id}});
   return row;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(!claimed)return Response.json({error:"Approval consumed, invalid custody, or insufficient K_BANK for simulation"},{status:409});
  // Reuse the EXACT simulator used by investor deallocation. Mock HTTP 200
  // never represents source confirmation, chain receipt or ledger settlement.
  try{
   const result=await submitMockKalshiWithdrawal({
    eventId:claimed.id,amountUsdcMicros:claimed.amountUsdcMicros,
    destination:claimed.masterWalletAddress
   });
   if(result.status!==200||result.mocked!==true||!result.withdrawalId)
    throw Error("Invalid Kalshi simulator acceptance");
   await prisma.$transaction(async tx=>{
    const updated=await tx.staffKalshiReturnSimulation.updateMany({where:{
     id:claimed.id,status:"CLAIMED"
    },data:{status:"MOCK_ACCEPTED",mockWithdrawalId:result.withdrawalId}});
    if(updated.count!==1)throw Error("Simulated return state changed");
    await tx.staffAudit.create({data:{actorId:actor,action:"kalshi.return.simulation.mock_accepted",
     resource:"wallets",targetId:claimed.id}});
   });
   return Response.json({id:claimed.id,status:"MOCK_ACCEPTED",simulated:true,
    execution:"SIMULATED_ONLY_NO_FUNDS_MOVED",destination:"CONFIGURED_MASTER_WALLET",
    treasuryChanged:false},{headers:{"Cache-Control":"no-store"}});
  }catch{
   await prisma.staffKalshiReturnSimulation.updateMany({where:{id:claimed.id,status:"CLAIMED"},
    data:{status:"SIMULATION_REVIEW"}});
   return Response.json({id:claimed.id,status:"SIMULATION_REVIEW",simulated:true,
    execution:"SIMULATION_OUTCOME_UNKNOWN_NO_FUNDS_MOVED"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
 }catch(error){
  if(error&&typeof error==="object"&&"code" in error&&error.code==="P2034")
   return Response.json({error:"Concurrent simulation claim; retry after review"},{status:409});
  if(error&&typeof error==="object"&&"code" in error&&error.code==="P2002")
   return Response.json({error:"Simulation already claimed"},{status:409});
  return staffWriteError(error);
 }
}
