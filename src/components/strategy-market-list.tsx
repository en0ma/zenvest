"use client";
import Link from "next/link";
type Row={id:string;name:string;symbol:string|null;logo:string|null;allocation:string;lifetime:string;dayPnl:string;dayPct:number|null;hourPct:number|null;monthPct:number|null;settledCount:number};
const fmt=(n:string)=>(Number(BigInt(n))/1e6).toLocaleString("en-US",{maximumFractionDigits:0});
function ReturnValue({value}:{value:number|null}){
 return <span className={"block whitespace-nowrap text-right text-sm font-semibold tabular-nums "+(value===null?"text-[#94A3B8]":value>0?"text-[#059669]":value<0?"text-[#E11D48]":"text-[#475569]")}>{value===null?"—":(value>0?"+":"")+value.toFixed(2)+"%"}</span>;
}
const columns="grid grid-cols-[minmax(180px,1fr)_110px_90px_90px_90px] items-center gap-x-4";
export function StrategyMarketList({rows}:{rows:Row[]}){
 const sorted=[...rows].sort((a,b)=>BigInt(b.allocation)>BigInt(a.allocation)?1:BigInt(b.allocation)<BigInt(a.allocation)?-1:0);
 return <section className="overflow-hidden rounded-2xl border border-[#E3E8EE] bg-white text-[#14253D]" aria-label="Strategy market">
  <header className="border-b border-[#EDF0F5] px-5 py-5 sm:px-7"><h1 className="text-lg font-semibold">Strategies</h1></header>
  <div className="overflow-x-auto overscroll-x-contain">
   <div className="min-w-[660px]">
    <div className={columns+" border-b border-[#EDF0F5] bg-[#F8FAFC] px-4 py-3 text-[11px] text-[#64748B] sm:px-6"}>
     <span>Strategy</span><span className="whitespace-nowrap text-right">Allocation</span><span className="whitespace-nowrap text-right">1h P&amp;L</span><span className="whitespace-nowrap text-right">24h P&amp;L</span><span className="whitespace-nowrap text-right">30d P&amp;L</span>
    </div>
    {sorted.map(row=><Link key={row.id} href={"/earn/strategies/"+encodeURIComponent(row.id)} className={columns+" min-h-[72px] border-b border-[#EDF0F5] px-4 py-3 transition hover:bg-[#F8FAFC] last:border-b-0 sm:px-6"}>
     <span className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#48566B] text-xs font-bold text-white">{row.logo&&(row.logo.startsWith("/")||row.logo.startsWith("https://"))?<img src={row.logo} alt="" className="h-full w-full object-cover"/>:(row.symbol??row.name).slice(0,2).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{row.symbol??row.name}</span><span className="block truncate text-[11px] text-[#64748B]">{row.name}</span></span></span>
     <span className="whitespace-nowrap text-right text-sm font-semibold tabular-nums">{fmt(row.allocation)} <span className="text-[10px] font-normal text-[#64748B]">USDC</span></span>
     <ReturnValue value={row.hourPct}/><ReturnValue value={row.dayPct}/><ReturnValue value={row.monthPct}/>
    </Link>)}
    {rows.length===0&&<p className="p-8 text-center text-sm text-[#64748B]">No public strategies available.</p>}
   </div>
  </div>
 </section>;
}
