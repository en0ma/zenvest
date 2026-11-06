import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";
/** Trusted domain boundary only, like investor Kalshi confirmation. Never call
 * from the mocked HTTP 200 or from a public request.
 */
export async function confirmVerifiedStaffKalshiWithdrawal(input:{
 withdrawalId:string;providerWithdrawalId:string;amountUsdcMicros:bigint;strategyWalletAddress:string;
}):Promise<string>{
 if(!input.withdrawalId||!input.providerWithdrawalId||input.providerWithdrawalId.startsWith("mock-withdrawal:")||
 input.amountUsdcMicros<=0n||!input.strategyWalletAddress)return "invalid";
 return prisma.$transaction(async tx=>{
  const item=await tx.staffKalshiWithdrawal.findUnique({where:{id:input.withdrawalId}});
  if(!item)return "not_found";
  await tx.$queryRaw`SELECT id FROM "strategies" WHERE id = ${item.strategyId} FOR UPDATE`;
  const strategy=await tx.strategy.findUnique({where:{id:item.strategyId}});
  if(!strategy||strategy.kalshiWalletAddress!==input.strategyWalletAddress||
   item.amountUsdcMicros!==input.amountUsdcMicros)return "mismatch";
  if(item.sourceConfirmed)return item.providerWithdrawalId===input.providerWithdrawalId?"duplicate":"mismatch";
  if(item.status!=="PROCESSING"||!item.providerWithdrawalId||
   !item.providerWithdrawalId.startsWith("mock-withdrawal:"))return "not_ready";
  const prior=await tx.treasuryTransfer.findFirst({where:{originExternalId:input.providerWithdrawalId}});
  if(prior)return "mismatch";
  const changed=await tx.staffKalshiWithdrawal.updateMany({where:{
   id:item.id,status:"PROCESSING",sourceConfirmed:false,providerWithdrawalId:item.providerWithdrawalId,
  },data:{sourceConfirmed:true,status:"CONFIRMING",providerWithdrawalId:input.providerWithdrawalId}});
  return changed.count===1?"confirming":"already_claimed";
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
