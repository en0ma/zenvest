import {prisma} from "./db.ts";
import {blockradarConfig} from "./blockradar.ts";
import {submitBlockradarWithdrawal,platformWithdrawalReference} from "./blockradar-payout.ts";
import {readBlockradarUsdcBalance} from "./blockradar-master-balance.ts";
/** Never submits a second attempt following an ambiguous provider call.
 * PENDING rows have already reserved platform treasury funds transactionally.
 */
export async function processPendingPlatformWithdrawal(id:string){
 if(process.env.STAFF_PLATFORM_WITHDRAWALS_ENABLED!=="true")return "disabled";
 const {key,walletId}=blockradarConfig();
 const assetId=process.env.BLOCKRADAR_SOLANA_USDC_ASSET_ID;
 if(!assetId)throw new Error("Missing Blockradar USDC asset");
 const item=await prisma.platformWithdrawal.findUnique({where:{id}});
 if(!item||item.status!=="PENDING")return "already_claimed";
 const action=await prisma.staffAction.findUnique({where:{id:item.staffActionId}});
 if(!action||action.status!=="EXECUTED"||action.resource!=="wallets"||action.operation!=="operate"||
  !action.decidedBy||action.decidedBy===action.requestedBy)return "invalid_approval";
 const master=await prisma.treasury.findUnique({where:{kind:"DEPOSIT"}});
 if(!master||master.walletId!==walletId||master.source!=="MASTER_WALLET"||master.asset!=="USDC"||master.network!=="solana")
  return "invalid_master";
 const changed=await prisma.platformWithdrawal.updateMany({where:{id,status:"PENDING"},data:{status:"SUBMITTING"}});
 if(changed.count!==1)return "already_claimed";
 let providerStarted=false;
 try{
  const [deposit,holds]=await Promise.all([
   prisma.treasury.findUnique({where:{kind:"DEPOSIT"}}),
   prisma.platformWithdrawal.aggregate({where:{status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},_sum:{amountUsdcMicros:true}})
  ]);
  if(!deposit||deposit.amount<0n||deposit.walletId!==walletId||deposit.source!=="MASTER_WALLET")
   throw Error("Invalid investor DEPOSIT custody");
  const outstanding=holds._sum.amountUsdcMicros??0n;
  const chain=await readBlockradarUsdcBalance({key,walletId,assetId});
  if(chain<deposit.amount+outstanding)
   throw Error("Insufficient unencumbered master custody");
  providerStarted=true;
  const receipt=await submitBlockradarWithdrawal({
   reference:platformWithdrawalReference(item.id),address:item.destinationAddress,amount:item.amountUsdcMicros,
   metadata:{source_type:"platform",platformWithdrawalId:item.id,staffActionId:item.staffActionId}
  },{key,walletId,assetId});
  await prisma.platformWithdrawal.updateMany({where:{id,status:"SUBMITTING"},data:{status:"PROCESSING",providerTransactionId:receipt.id,transactionHash:receipt.hash}});
  return "submitted";
 }catch{
  if(!providerStarted){
   await prisma.platformWithdrawal.updateMany({where:{id,status:"SUBMITTING"},data:{status:"PENDING"}});
   return "preflight_retry";
  }
  await prisma.platformWithdrawal.updateMany({where:{id,status:"SUBMITTING"},data:{status:"REVIEW",failureCode:"PROVIDER_RESPONSE_UNKNOWN"}});
  return "review_pending";
 }
}
