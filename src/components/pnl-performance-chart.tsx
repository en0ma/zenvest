"use client";
import {useMemo,useState} from "react";
type Point={day:string;netMicros:string};
const money=(n:bigint)=>{const a=n<0n?-n:n;return (n<0n?"−":"")+(Number(a)/1e6).toLocaleString("en-US",{style:"currency",currency:"USD"})};
export function PnlPerformanceChart({rows}:{rows:Point[]}){
 const [range,setRange]=useState<"7D"|"30D"|"90D"|"ALL">("30D");
 const series=useMemo(()=>{
  const totals=new Map<string,bigint>();
  for(const p of rows)totals.set(p.day,(totals.get(p.day)??0n)+BigInt(p.netMicros));
  const days=[...totals.keys()].sort();
  let cumulative=0n;
  return days.map(day=>{cumulative+=totals.get(day)??0n;return {day,cumulative};});
 },[rows]);
 const cutoff=range==="ALL"?null:new Date(Date.now()-Number.parseInt(range,10)*86400000).toISOString().slice(0,10);
 const preceding=cutoff?series.filter(x=>x.day<cutoff):[];
 const base=preceding.length?preceding[preceding.length-1].cumulative:0n;
 const shown=series.filter(x=>!cutoff||x.day>=cutoff);
 const points=shown.map(x=>({day:x.day,amount:x.cumulative-base}));
 const n=points.length,values=points.map(x=>Number(x.amount)/1e6);
 const low=Math.min(0,...values),high=Math.max(0,...values),span=high-low||1;
 const path=points.map((p,i)=>[40+(n===1?0:i/(n-1)*720),212-(Number(p.amount)/1e6-low)/span*176] as const);
 const polyline=path.map(([x,y])=>x+","+y).join(" ");
 return <section className="min-w-0" aria-label="Cumulative settled event P&L">
  <div className="flex flex-wrap items-center justify-between gap-4"><div>
   <h2 className="text-lg font-semibold text-[#11263E]">Cumulative realized P&amp;L</h2>
   <p className="mt-1 text-sm text-[#64748B]">Verified investor net results, excluding deposits, withdrawals and internal capital transfers</p>
  </div><div className="flex gap-1 rounded-xl bg-[#F1F4FA] p-1">{(["7D","30D","90D","ALL"] as const).map(v=><button key={v} type="button" onClick={()=>setRange(v)} aria-pressed={v===range} className={"rounded-lg px-3 py-1.5 text-xs font-semibold "+(v===range?"bg-white text-[#11263E] shadow-sm":"text-[#64748B]")}>{v}</button>)}</div></div>
  {!points.length?<div className="mt-5"><p className="text-3xl font-semibold tabular-nums text-[#14253D]">$0.00 <span className="text-sm font-normal text-[#64748B]">USDC P&amp;L</span></p><svg role="img" aria-label="Cumulative realized P&L chart, no settled trades for selected period. Zero baseline shown." viewBox="0 0 800 260" className="mt-4 w-full" preserveAspectRatio="xMidYMid meet"><line x1="40" x2="760" y1="36" y2="36" stroke="#E9EEF6" strokeDasharray="4 5"/><line x1="40" x2="760" y1="124" y2="124" stroke="#E9EEF6" strokeDasharray="4 5"/><line x1="40" x2="760" y1="212" y2="212" stroke="#DBE4F1"/><line x1="40" x2="760" y1="124" y2="124" stroke="#635BFF" strokeWidth="2" strokeDasharray="6 6"/><text x="40" y="243" fontSize="13" fill="#64748B">Start</text><text x="760" y="243" textAnchor="end" fontSize="13" fill="#64748B">Today</text></svg><p className="text-center text-xs text-[#64748B]">No settled trades in this period · zero baseline is illustrative</p></div>:
  <><p className={"mt-5 text-3xl font-semibold tabular-nums "+((points.at(-1)?.amount??0n)<0n?"text-red-600":"text-emerald-700")}>{money(points.at(-1)?.amount??0n)} <span className="text-sm font-normal text-[#64748B]">USDC P&amp;L</span></p>
  <svg role="img" aria-label={`Cumulative net realized P&L, ${points.length} daily observations, ending at ${money(points.at(-1)?.amount??0n)}`} viewBox="0 0 800 260" className="mt-4 w-full" preserveAspectRatio="xMidYMid meet">
   <line x1="40" x2="760" y1="212" y2="212" stroke="#DBE4F1"/>
   <line x1="40" x2="760" y1="124" y2="124" stroke="#E9EEF6" strokeDasharray="4 5"/>
   <line x1="40" x2="760" y1="36" y2="36" stroke="#E9EEF6" strokeDasharray="4 5"/>
   <line x1="40" x2="760" y1={212-(0-low)/span*176} y2={212-(0-low)/span*176} stroke="#64748B" strokeDasharray="3 6"/>
   <polyline points={polyline} fill="none" stroke={(values.at(-1)??0)<0?"#E25656":"#10A984"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
   {path.length===1&&<circle cx={path[0][0]} cy={path[0][1]} r="5" fill="#10A984"/>}
   <text x="40" y="243" fontSize="13" fill="#64748B">{points[0].day}</text>
   <text x="760" y="243" textAnchor="end" fontSize="13" fill="#64748B">{points.at(-1)?.day}</text>
  </svg></>}
  <p className="mt-2 text-xs text-[#94A3B8]">This chart shows settled trading P&amp;L, not historical account valuation or investment rate of return.</p>
 </section>;
}
