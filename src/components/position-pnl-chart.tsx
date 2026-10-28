"use client";
import {useState} from "react";
type Point={time:string;amount:number};
const periods=[["24H",86400000],["7D",604800000],["30D",2592000000],["ALL",Infinity]] as const;
export function PositionPnlChart({points}:{points:Point[]}){
 const [period,setPeriod]=useState("ALL");
 const duration=periods.find(p=>p[0]===period)?.[1]??Infinity;
 const filtered=points.filter(p=>duration===Infinity||Date.parse(p.time)>=Date.now()-duration);
 let net=0;const cumulative=filtered.map(p=>({date:p.time,total:(net+=p.amount)}));
 const values=[0,...cumulative.map(p=>p.total)],low=Math.min(...values),high=Math.max(...values),span=high-low||1;
 const line=[{x:0,y:0},...cumulative.map((p,i)=>({x:((i+1)/cumulative.length)*100,y:p.total}))].map((p,i)=>`${i===0?"M":"L"} ${p.x.toFixed(3)} ${(90-(p.y-low)/span*80).toFixed(3)}`).join(" ");
 return <section className="rounded-2xl border border-[#DFE5EF] bg-white p-4 text-[#243553] sm:p-6">
 <div className="flex flex-wrap items-start justify-between gap-4">
 <div><h2 className="text-sm font-semibold text-[#243553]">Cumulative P&amp;L</h2><p className={"mt-2 text-2xl font-bold tabular-nums "+(net<0?"text-rose-600":"text-emerald-600")}>{net>0?"+":""}{net.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} USDC</p></div>
 <div className="flex flex-wrap gap-1" aria-label="P&L chart period">{periods.map(([label])=><button key={label} type="button" aria-pressed={period===label} onClick={()=>setPeriod(label)} className={"rounded-lg px-3 py-2 text-xs font-semibold "+(period===label?"bg-[#E9ECFB] text-[#625DC1]":"text-[#64748B] hover:bg-[#F8FAFC]")}>{label}</button>)}</div>
 </div>
 <div className="relative mt-6 h-[170px] sm:h-[260px]" role="img" aria-label={`Cumulative settled investment P&L over ${filtered.length} settlements`}>
 <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">{[10,30,50,70,90].map(y=><line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#E5EAF0" strokeWidth=".22"/>)}<path d={line} stroke={net<0?"#E11D48":"#059669"} strokeWidth="1.8" vectorEffect="non-scaling-stroke" fill="none"/></svg>
 {filtered.length===0&&<p className="absolute inset-0 flex items-center justify-center text-center text-sm text-[#A6B3C5]">No settled P&amp;L for this period</p>}
 </div>
 <p className="mt-3 text-xs text-[#A6B3C5]">Based on settled investment results</p>
 </section>;
}
