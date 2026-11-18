/** Nonpayable scenario ONLY. Does not change investor equity or treasury.
 * Existing platform fee is reported separately, not reapplied. */
import {platformProfitFee} from "./position-pnl-math.ts";
export function previewBotStrategySplit(gross:bigint,previousFee:bigint,managerRate:string,platformRate:string){
 if(previousFee<0n||previousFee>(gross>0n?gross:0n))throw Error("Invalid existing fee evidence");
 const manager=platformProfitFee(gross,managerRate),platform=platformProfitFee(gross,platformRate);
 if(manager+platform>(gross>0n?gross:0n))throw Error("Combined strategy rates exceed 100%");
 return {managerCandidate:manager,platformCandidate:platform,
  investorCandidate:gross-manager-platform,existingPlatformFee:previousFee,
  existingInvestorNet:gross-previousFee};
}
