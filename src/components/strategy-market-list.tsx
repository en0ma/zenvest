"use client";
import Link from "next/link";
import {useState} from "react";
type Row={id:string;name:string;symbol:string|null;logo:string|null;allocation:string;lifetime:string;dayPnl:string;dayPct:number|null;settledCount:number};
const money=(n:string)=>Number(BigInt(n))/1e6;
const fmt=(n:string)=>money(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
export function StrategyMarketList({rows}:{rows:Row[]}){
 const [sort,setSort]=useState<"name"|"allocation"|"pnl">("allocation");
 const sorted=[...rows].sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="pnl"?money(b.dayPnl)-money(a.dayPnl):money(b.allocation)-money(a.allocation));
 return <section className="overflow-hidden rounded-2xl border border-[#E3E8EE] bg-[#252D39] text-[#E9EDF3]" aria-label="Strategy market">
  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-5 sm:px-6">
   <div><h1 className="text-xl font-semibold">Strategies</h1><p className="mt-1 text-xs text-[#A2ADBF]">Allocation and performance overview</p></div>
   <div className="flex items-center gap-2 text-xs"><label htmlFor="market-sort" className="text-[#A2ADBF]">Sort by</label><select id="market-sort" value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="rounded-lg border border-white/20 bg-[#303B4D] p-2 text-white"><option value="allocation">Allocation</option><option value="pnl">24h P&amp;L</option><option value="name">Name</option></select></div>
  </header>
  <div className="grid grid-cols-[minmax(0,1fr)_95px_88px] gap-2 border-b border-white/10 px-4 py-3 text-[11px] text-[#97A4B7] sm:grid-cols-[minmax(0,1fr)_145px_130px] sm:px-6"><span>Strategy</span><span className="text-right">Allocation</span><span className="text-right">24h P&amp;L</span></div>
  {sorted.map(row=><Link key={row.id} href={"/earn/strategies/"+encodeURIComponent(row.id)} className="grid grid-cols-[minmax(0,1fr)_95px_88px] items-center gap-2 border-b border-white/10 px-4 py-4 transition hover:bg-white/5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_145px_130px] sm:px-6">
   <span className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#48566B] font-bold">{row.logo&&(row.logo.startsWith("/")||row.logo.startsWith("https://"))?<img src={row.logo} alt="" className="h-full w-full object-cover"/>:(row.symbol??row.name).slice(0,2).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold sm:text-base">{row.symbol??row.name}</span><span className="block truncate text-xs text-[#9DA8B8]">{row.name}</span></span></span>
   <span className="text-right text-sm font-semibold tabular-nums">{fmt(row.allocation)}<span className="block text-[10px] font-normal text-[#9DA8B8]">USDC allocated</span></span>
   <span className="text-right"><span className={"inline-flex min-w-[76px] justify-center rounded-md px-2 py-2 text-xs font-semibold tabular-nums "+(BigInt(row.dayPnl)>0n?"bg-emerald-500/20 text-emerald-300":BigInt(row.dayPnl)<0n?"bg-rose-500/20 text-rose-300":"bg-white/10 text-[#BDC6D1]")}>{row.settledCount===0?"—":(BigInt(row.dayPnl)>0n?"+":"")+fmt(row.dayPnl)}</span><span className="mt-1 block text-[10px] text-[#9DA8B8]">{row.dayPct===null?"24h return —":(row.dayPct>0?"+":"")+row.dayPct.toFixed(2)+"%"}</span></span>
  </Link>)}
  {rows.length===0&&<p className="p-8 text-center text-sm text-[#A2ADBF]">No public strategies available.</p>}
 </section>;
}
