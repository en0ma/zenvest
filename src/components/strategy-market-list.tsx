"use client";
import Link from "next/link";
import {useState} from "react";
type Row={id:string;name:string;symbol:string|null;logo:string|null;allocation:string;lifetime:string;dayPnl:string;dayPct:number|null;hourPct:number|null;monthPct:number|null;settledCount:number};
const fmt=(n:string)=>(Number(BigInt(n))/1e6).toLocaleString("en-US",{maximumFractionDigits:0});
function ReturnValue({value}:{value:number|null}){
 return <span className={"block whitespace-nowrap text-right text-sm font-semibold tabular-nums "+(value===null?"text-[#A2ADBF]":value>0?"text-[#34D399]":value<0?"text-[#FB7185]":"text-[#D9DEE7]")}>{value===null?"—":(value>0?"+":"")+value.toFixed(2)+"%"}</span>;
}
const columns="grid grid-cols-[minmax(180px,1fr)_110px_90px_90px_90px] items-center gap-x-4";
export function StrategyMarketList({rows}:{rows:Row[]}){
 const [sort,setSort]=useState<"name"|"allocation"|"hour"|"day"|"month">("allocation");
 const sorted=[...rows].sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="allocation"?(BigInt(b.allocation)>BigInt(a.allocation)?1:BigInt(b.allocation)<BigInt(a.allocation)?-1:0):(sort==="hour"?b.hourPct??-Infinity:sort==="day"?b.dayPct??-Infinity:b.monthPct??-Infinity)-(sort==="hour"?a.hourPct??-Infinity:sort==="day"?a.dayPct??-Infinity:a.monthPct??-Infinity));
 return <section className="overflow-hidden rounded-2xl border border-[#E3E8EE] bg-[#252D39] text-[#E9EDF3]" aria-label="Strategy market">
  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-5 sm:px-6">
   <div><h1 className="text-xl font-semibold">Strategies</h1><p className="mt-1 text-xs text-[#A2ADBF]">Allocation and settled P&amp;L performance</p></div>
   <div className="flex items-center gap-2 text-xs"><label htmlFor="market-sort" className="text-[#A2ADBF]">Sort by</label><select id="market-sort" value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="rounded-lg border border-white/20 bg-[#303B4D] p-2 text-white"><option value="allocation">Allocation</option><option value="hour">1h P&amp;L</option><option value="day">24h P&amp;L</option><option value="month">30d P&amp;L</option><option value="name">Name</option></select></div>
  </header>
  <div className="overflow-x-auto overscroll-x-contain">
   <div className="min-w-[660px]">
    <div className={columns+" border-b border-white/10 px-4 py-3 text-[11px] text-[#97A4B7] sm:px-6"}>
     <span>Strategy</span><span className="whitespace-nowrap text-right">Allocation</span><span className="whitespace-nowrap text-right">1h P&amp;L</span><span className="whitespace-nowrap text-right">24h P&amp;L</span><span className="whitespace-nowrap text-right">30d P&amp;L</span>
    </div>
    {sorted.map(row=><Link key={row.id} href={"/earn/strategies/"+encodeURIComponent(row.id)} className={columns+" min-h-[72px] border-b border-white/10 px-4 py-3 transition hover:bg-white/5 last:border-b-0 sm:px-6"}>
     <span className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#48566B] text-xs font-bold">{row.logo&&(row.logo.startsWith("/")||row.logo.startsWith("https://"))?<img src={row.logo} alt="" className="h-full w-full object-cover"/>:(row.symbol??row.name).slice(0,2).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{row.symbol??row.name}</span><span className="block truncate text-[11px] text-[#9DA8B8]">{row.name}</span></span></span>
     <span className="whitespace-nowrap text-right text-sm font-semibold tabular-nums">{fmt(row.allocation)} <span className="text-[10px] font-normal text-[#9DA8B8]">USDC</span></span>
     <ReturnValue value={row.hourPct}/><ReturnValue value={row.dayPct}/><ReturnValue value={row.monthPct}/>
    </Link>)}
    {rows.length===0&&<p className="p-8 text-center text-sm text-[#A2ADBF]">No public strategies available.</p>}
   </div>
  </div>
 </section>;
}
