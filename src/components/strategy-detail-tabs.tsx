"use client";
import {useState} from "react";
type Point={time:string;pnl:number};
export function StrategyDetailTabs({points,description,note,stats}:{points:Point[];description:string;note:string|null;stats:{market:string;status:string;total:string;settlements:number;capacity:string}}){
 const [tab,setTab]=useState<"price"|"info">("price");
 const [range,setRange]=useState("ALL");
 const ranges=[["24H",86400000],["7D",7*86400000],["30D",30*86400000],["ALL",Infinity]] as const;
 const window=ranges.find(x=>x[0]===range)?.[1]??Infinity;
 const data=points.filter(p=>window===Infinity||Date.parse(p.time)>=Date.now()-window);
 let total=0;
 const cumulative=data.map(p=>({time:p.time,value:(total+=p.pnl)}));
 const values=[0,...cumulative.map(p=>p.value)],min=Math.min(...values),max=Math.max(...values),span=max-min||1;
 const coords=[{x:0,y:0},...cumulative.map((p,i)=>({x:(i+1)*100/(cumulative.length||1),y:p.value}))];
 const path=coords.map((p,i)=>`${i===0?"M":"L"} ${p.x.toFixed(2)} ${(90-(p.y-min)/span*80).toFixed(2)}`).join(" ");
 return <section className="overflow-hidden rounded-2xl border border-[#35404E] bg-[#202934] text-white">
  <nav className="flex border-b border-white/10" aria-label="Strategy details">
   {(["price","info"] as const).map(t=><button key={t} type="button" aria-selected={tab===t} onClick={()=>setTab(t)} className={"px-6 py-4 text-sm font-semibold capitalize "+(tab===t?"border-b-2 border-amber-400 text-white":"text-[#9BA8BA]")}>{t}</button>)}
  </nav>
  {tab==="price"?<div className="space-y-5 p-5 sm:p-7">
   <div><p className="text-xs text-[#9BA8BA]">Cumulative verified net P&amp;L · {range}</p><p className={"mt-2 text-3xl font-semibold "+(total<0?"text-rose-400":"text-emerald-300")}>{total>0?"+":""}{total.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} USDC</p></div>
   <div className="flex flex-wrap gap-2">{ranges.map(([label])=><button type="button" key={label} onClick={()=>setRange(label)} aria-pressed={range===label} className={"rounded-lg px-3 py-2 text-xs "+(range===label?"bg-white/20 text-white":"text-[#9BA8BA]")}>{label}</button>)}</div>
   <div className="relative h-[240px] w-full sm:h-[360px]" role="img" aria-label={"Cumulative P&L across "+cumulative.length+" settlement events"}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">{[10,30,50,70,90].map(y=><line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#3A4656" strokeWidth=".25"/>)}<path d={path} stroke={total<0?"#F87171":"#34D399"} fill="none" strokeWidth="1.2" vectorEffect="non-scaling-stroke"/></svg>
    {data.length===0&&<div className="absolute inset-0 flex items-center justify-center text-center text-sm text-[#9BA8BA]">No settled P&amp;L records in this period</div>}
   </div>
   <p className="text-xs leading-5 text-[#9BA8BA]">This chart plots verified settled trade events, not tick-by-tick mark-to-market estimates.</p>
  </div>:<div className="space-y-5 p-5 sm:p-7">
   <div><h2 className="font-semibold">About this strategy</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#C1CAD6]">{description}</p></div>
   {note&&<div><h3 className="font-semibold">Notes</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#C1CAD6]">{note}</p></div>}
   <dl className="grid gap-4 sm:grid-cols-2">{[["Market",stats.market],["Status",stats.status],["Current allocation",stats.total+" USDC"],["Verified P&L records",String(stats.settlements)],["Available capacity",stats.capacity+" USDC"]].map(([key,value])=><div key={key} className="border-t border-white/10 pt-3"><dt className="text-xs text-[#9BA8BA]">{key}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>)}</dl>
  </div>}
 </section>;
}
