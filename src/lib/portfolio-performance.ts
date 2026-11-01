export type PortfolioEvent={
 id:string;
 at:Date;
 kind:"DEPOSIT"|"WITHDRAWAL"|"TRANSFER_IN"|"TRANSFER_OUT"|"PNL";
 amountMicros:bigint; // positive deposit, negative withdrawal, signed settled P&L
};
export type PortfolioPoint={at:string;valueMicros:string;kind:PortfolioEvent["kind"]|"START"};
export type PortfolioPerformance={
 points:PortfolioPoint[];
 twrPercent:number|null;
 simplePnlPercent:number|null;
 completeHistory:boolean;
 initialValueMicros:bigint;
};

/** Reconstruct settled equity from authoritative completed cash flows and trade P&L.
 * No market-to-market pricing is inferred.
 * Same-timestamp events are consistently sorted by ID, but if their true
 * economic ordering is unknown, results are only as precise as stored timestamps.
 */
export function reconstructPortfolioPerformance(
 currentValueMicros:bigint,events:PortfolioEvent[],
):PortfolioPerformance{
 const ordered=[...events].sort((a,b)=>a.at.getTime()-b.at.getTime()||
  a.id.localeCompare(b.id));
 const sum=ordered.reduce((n,e)=>n+e.amountMicros,0n);
 const initial=currentValueMicros-sum;
 // If a balance adjustment or missing flow exists, we cannot confidently
 // claim a fully reconciled series or exact return.
 const completeHistory=initial===0n;
 let value=initial;
 let twrFactor=1;
 let twrValid=completeHistory;
 let pnl=0n,deposits=0n;
 const points:PortfolioPoint[]=[];
 if(ordered.length)points.push({at:ordered[0].at.toISOString(),valueMicros:initial.toString(),kind:"START"});
 for(const event of ordered){
  const before=value;
  if(event.kind==="PNL"){
   pnl+=event.amountMicros;
   if(before<=0n){if(event.amountMicros!==0n)twrValid=false;}
   else {
    const rate=Number(event.amountMicros)/Number(before);
    if(!Number.isFinite(rate)||1+rate<0)twrValid=false;
    else twrFactor*=1+rate;
   }
  }else if(event.kind==="TRANSFER_IN"){
   if(event.amountMicros<=0n)twrValid=false;
  }else if(event.kind==="TRANSFER_OUT"){
   if(event.amountMicros>=0n)twrValid=false;
  }else if(event.kind==="DEPOSIT"){
   if(event.amountMicros<=0n)twrValid=false;
   deposits+=event.amountMicros;
  }else if(event.amountMicros>=0n)twrValid=false;
  value+=event.amountMicros;
  if(value<0n)twrValid=false;
  points.push({at:event.at.toISOString(),valueMicros:value.toString(),kind:event.kind});
 }
 if(value!==currentValueMicros)twrValid=false;
 const twrPercent=twrValid&&Number.isFinite(twrFactor)?(twrFactor-1)*100:null;
 const simplePnlPercent=completeHistory&&deposits>0n?
  Number(pnl)*100/Number(deposits):null;
 return {points,twrPercent,simplePnlPercent,completeHistory,
  initialValueMicros:initial};
}
