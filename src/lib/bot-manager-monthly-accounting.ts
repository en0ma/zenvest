import {distributeWeightedMicros,platformProfitFee} from "./position-pnl-math.ts";
/** Monthly no-carry profit sharing. Never posts to wallets or investor ledgers.
 * Profits and losses offset WITHIN the UTC month; no prior-month carry/HWM.
 * Rates remain frozen per trade at its exposure snapshot. */
export type VerifiedNetTrade={
 id:string;grossMicros:bigint;venueFeeMicros:bigint;custodyFeeMicros:bigint;
 operationalFeeMicros:bigint;managerRate:string;platformRate:string;
};
export function calculateMonthlyBotStrategySplit(rows:VerifiedNetTrade[]){
 if(!rows.length)return {gross:0n,costs:0n,net:0n,manager:0n,platform:0n,investors:0n,tradeCount:0};
 if(new Set(rows.map(x=>x.id)).size!==rows.length)throw Error("Duplicate verified trade");
 let gross=0n,costs=0n;
 const netRows=rows.map(x=>{
  for(const amount of [x.venueFeeMicros,x.custodyFeeMicros,x.operationalFeeMicros])
   if(amount<0n)throw Error("Negative verified cost");
  // Validate every frozen rate even when the month is unprofitable.
  platformProfitFee(1_000_000n,x.managerRate);
  platformProfitFee(1_000_000n,x.platformRate);
  if(platformProfitFee(1_000_000n,x.managerRate)+platformProfitFee(1_000_000n,x.platformRate)>1_000_000n)
   throw Error("Combined strategy shares exceed 100%");
  const fee=x.venueFeeMicros+x.custodyFeeMicros+x.operationalFeeMicros;
  gross+=x.grossMicros;costs+=fee;
  return {...x,netMicros:x.grossMicros-fee};
 });
 const net=gross-costs;
 // Non-positive *monthly* net produces no positive manager/platform earnings;
 // this is NOT a loss carryforward or a high-water mark.
 if(net<=0n)return {gross,costs,net,manager:0n,platform:0n,investors:net,tradeCount:rows.length};
 const wins=netRows.filter(x=>x.netMicros>0n);
 if(!wins.length)throw Error("Positive month without positive event");
 const capital=netRows.reduce((n,r)=>n+(r.netMicros>0n?r.netMicros:0n),0n);
 if(capital<net)throw Error("Inconsistent monthly net");
 const weights=wins.map(x=>({id:x.id,eligibleCapitalUsdcMicros:x.netMicros}));
 const eligible=distributeWeightedMicros(net,weights);
 let manager=0n,platform=0n;
 for(const x of wins){
  const allotted=eligible.get(x.id)??0n;
  manager+=platformProfitFee(allotted,x.managerRate);
  platform+=platformProfitFee(allotted,x.platformRate);
 }
 if(manager+platform>net)throw Error("Invalid net profit distribution");
 return {gross,costs,net,manager,platform,investors:net-manager-platform,tradeCount:rows.length};
}
export function utcMonthWindow(month:string){
 if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month))throw Error("Invalid UTC accounting month");
 const year=Number(month.slice(0,4)),m=Number(month.slice(5,7));
 if(year<2020||year>2100)throw Error("Invalid UTC accounting year");
 return {start:new Date(Date.UTC(year,m-1,1)),end:new Date(Date.UTC(year,m,1))};
}
