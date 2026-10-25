import {prisma} from "./db.ts";
import {validSweptDeposit,parsePositiveUsdcMicros} from "./blockradar-event-validation.ts";
import {settleVerifiedStrategyReturn} from "./strategy-return-settlement.ts";

/** Called only from the HMAC-authenticated Blockradar webhook processor.
 * Metadata routes strategy funds separately from user deposits. A signed,
 * successful sweep into the master wallet is required, not just deposit.success.
 */
export async function handleStrategySweptDeposit(data:Record<string,unknown>,mint:string,masterWalletId:string){
 const metadata=data.metadata&&typeof data.metadata==="object"?
  data.metadata as Record<string,unknown>:{};
 if(metadata.source_type!=="strategy")return "unrelated";
 const address=data.address&&typeof data.address==="object"?data.address as Record<string,unknown>:{};
 const recipient=data.recipientAddress;
 const amount=parsePositiveUsdcMicros(data.amountPaid??data.amount);
 const master=data.wallet&&typeof data.wallet==="object"?data.wallet as Record<string,unknown>:{};
 if(typeof recipient!=="string"||!amount||typeof data.id!=="string"||
  typeof data.hash!=="string"||!validSweptDeposit(data,mint,masterWalletId,recipient,amount))
  return "invalid_sweep";
 const strategy=await prisma.strategy.findUnique({where:{blockRadarAddress:recipient}});
 if(!strategy||!strategy.blockRadarAddressId||address.id!==strategy.blockRadarAddressId)return "unknown_strategy_address";
 const candidateId=typeof metadata.strategy_event_id==="string"?metadata.strategy_event_id:null;
 const candidates=await prisma.strategyEvent.findMany({where:{
  strategyId:strategy.id,kind:"DEALLOCATE",
  ...(candidateId?{id:candidateId}:{}),
  status:"CONFIRMING",sourceConfirmed:true,destinationConfirmed:false,
  amountUsdcMicros:amount,
 },select:{id:true,kalshiWithdrawalId:true},take:2});
 if(candidates.length!==1||!candidates[0].kalshiWithdrawalId)return "unmatched_withdrawal";
 return settleVerifiedStrategyReturn({
  strategyEventId:candidates[0].id,
  kalshiWithdrawalId:candidates[0].kalshiWithdrawalId,
  masterReceiptId:data.id,
  kalshiWalletAddress:strategy.kalshiWalletAddress??"",
  masterWalletAddress:String(master.address??""),
  amountUsdcMicros:amount,asset:"USDC",network:"solana"
 });
}
