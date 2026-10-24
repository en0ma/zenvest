"use client";
import {useMemo} from "react";
type Point={at:string;valueMicros:string;kind:string};
export function PortfolioValueChart({points}:{points:Point[]}){
 const chart=useMemo(()=>{
  const sorted=points.slice(-300);
  if(sorted.length<2)return null;
  const values=sorted.map(p=>Number(BigInt(p.valueMicros))/1e6);
  const min=Math.min(...values),max=Math.max(...values),range=max-min||1;
  const width=760,height=240,pad=24;
  const step=(width-2*pad)/(values.length-1);
  const path=values.map((v,i)=>`${i?"L":"M"} ${pad+i*step} ${height-pad-(v-min)/range*(height-2*pad)}`).join(" ");
  return {path,min,max,first:sorted[0].at,last:sorted[sorted.length-1].at};
 },[points]);
 return <section aria-labelledby="portfolio-history-heading" className="rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
  <h2 id="portfolio-history-heading" className="text-lg font-semibold text-[#11263E]">Historical settled portfolio value</h2>
  <p className="mt-1 text-sm text-[#64748B]">Reconstructed from completed deposits, withdrawals and settled trade P&amp;L. Deposits are not investment profit.</p>
  {chart?<div className="mt-6">
   <svg viewBox="0 0 760 240" role="img" aria-label="Historical settled portfolio balance in USDC" className="h-auto w-full">
    <path d={chart.path} fill="none" stroke="#635BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
   </svg>
   <div className="mt-2 flex justify-between text-xs text-[#64748B]"><span>{new Date(chart.first).toLocaleDateString("en-US")}</span><span>{new Date(chart.last).toLocaleDateString("en-US")}</span></div>
  </div>:<p className="mt-6 rounded-xl bg-[#F8FAFD] p-8 text-center text-sm text-[#64748B]">Historical chart will appear after verified financial events are recorded.</p>}
  <p className="mt-3 text-xs text-[#94A3B8]">Live unrealized market valuation is not included.</p>
 </section>;
}
