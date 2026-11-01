"use client";
import Link from "next/link";
import {useState} from "react";
type Row={id:string;name:string;symbol:string|null;logo:string|null;allocation:string;lifetime:string;dayPnl:string;dayPct:number|null;hourPct:number|null;monthPct:number|null;settledCount:number};
const fmt=(n:string)=>(Number(BigInt(n))/1e6).toLocaleString("en-US",{maximumFractionDigits:0});
function ReturnValue({value}:{value:number|null}){
 return <span className={"whitespace-nowrap text-sm font-semibold tabular-nums "+(value===null?"text-[#94A3B8]":value>0?"text-[#059669]":value<0?"text-[#E11D48]":"text-[#475569]")}>{value===null?"—":(value>0?"+":"")+value.toFixed(2)+"%"}</span>;
}
export function StrategyMarketList({rows}:{rows:Row[]}){
 const [expanded,setExpanded]=useState<string|null>(null);
 const sorted=[...rows].sort((a,b)=>BigInt(b.allocation)>BigInt(a.allocation)?1:BigInt(b.allocation)<BigInt(a.allocation)?-1:0);
 return <section className="overflow-hidden rounded-2xl border border-[#E3E8EE] bg-white text-[#14253D]" aria-label="Investment options">
  {sorted.map(row=>{
   const open=expanded===row.id;
   const href="/earn/strategies/"+encodeURIComponent(row.id);
   return <div key={row.id} className="border-b border-[#EDF0F5] last:border-b-0">
    <div className="flex min-h-[72px] items-center gap-3 px-4 py-3 sm:px-6">
     <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#635BFF]" aria-label={"View "+row.name}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#48566B] text-xs font-bold text-white">{row.logo&&(row.logo.startsWith("/")||row.logo.startsWith("https://"))?<img src={row.logo} alt="" className="h-full w-full object-cover"/>:(row.symbol??row.name).slice(0,2).toUpperCase()}</span>
      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{row.symbol??row.name}</span><span className="block text-xs leading-5 text-[#64748B]">{fmt(row.allocation)} USDC invested in total</span></span>
     </Link>
     <button type="button" onClick={()=>setExpanded(open?null:row.id)} aria-expanded={open} aria-controls={"market-details-"+row.id} aria-label={(open?"Collapse ":"Expand ")+row.name+" performance"} className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#635BFF]">
      <ReturnValue value={row.dayPct}/>
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={"h-4 w-4 text-[#64748B] transition-transform "+(open?"rotate-180":"")}><path d="m5 7 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
     </button>
    </div>
    {open&&<div id={"market-details-"+row.id} className="bg-[#F8FAFC] px-4 py-4 sm:px-6">
     <div className="grid grid-cols-3 gap-2">{([["Past hour",row.hourPct],["Past day",row.dayPct],["Past 30 days",row.monthPct]] as const).map(([label,value])=><div key={label} className="flex min-w-0 flex-col items-center gap-1 rounded-lg bg-white px-1 py-3"><span className="text-[11px] text-[#64748B]">{label}</span><ReturnValue value={value}/></div>)}
     </div>
    </div>}
   </div>;
  })}
  {rows.length===0&&<p className="p-8 text-center text-sm text-[#64748B]">No investment options are available right now.</p>}
 </section>;
}
