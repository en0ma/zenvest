"use client";
import Link from "next/link";
import {useState} from "react";
type PositionRow={id:string;strategy:string;allocation:string;status:string};
const PAGE_SIZE=10;
export function PositionsTable({rows}:{rows:PositionRow[]}){
 const [page,setPage]=useState(1);
 const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
 const current=Math.min(page,pages);
 const start=(current-1)*PAGE_SIZE;
 return <section aria-label="Your positions" className="overflow-hidden rounded-2xl border border-[#E3E8EE] bg-white">
  <header className="border-b border-[#EDF0F5] px-5 py-5 sm:px-7"><h2 className="text-lg font-semibold text-[#14253D]">Positions</h2><p className="mt-1 text-xs text-[#64748B]">View and manage your strategy positions.</p></header>
  <div className="divide-y divide-[#EDF0F5] md:hidden">{rows.slice(start,start+PAGE_SIZE).map(p=><Link key={p.id} href={"/earn/positions/"+encodeURIComponent(p.id)} className="flex items-center justify-between gap-3 px-4 py-4"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#14253D]">{p.strategy} ···{p.id.slice(-6)}</span><span className="mt-1 block text-xs text-[#64748B]">{p.allocation} USDC allocated · {p.status}</span></span><span className="shrink-0 text-xs font-semibold text-[#635BFF]">View →</span></Link>)}</div><div className="hidden overflow-x-auto overscroll-x-contain md:block">
   <table className="w-full min-w-[700px] text-left text-sm">
    <thead className="bg-[#F8FAFC] text-xs text-[#64748B]"><tr>{["Strategy","Position","Allocated USDC","Status","Action"].map(h=><th key={h} className="whitespace-nowrap px-5 py-3">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-[#EDF0F5]">{rows.slice(start,start+PAGE_SIZE).map(p=><tr key={p.id}><td className="whitespace-nowrap px-5 py-4 font-semibold">{p.strategy}</td><td className="whitespace-nowrap px-5 py-4 font-mono text-xs">{p.id}</td><td className="whitespace-nowrap px-5 py-4 tabular-nums">{p.allocation}</td><td className="whitespace-nowrap px-5 py-4">{p.status}</td><td className="whitespace-nowrap px-5 py-4"><Link href={"/earn/positions/"+encodeURIComponent(p.id)} className="font-semibold text-[#635BFF] hover:underline">View position</Link></td></tr>)}</tbody>
   </table>
   
  </div>
  {rows.length===0&&<p className="p-6 text-center text-sm text-[#64748B]">No positions yet. Select a strategy above to open one.</p>}
  <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF0F5] px-5 py-4 sm:px-7">
   <p className="text-xs text-[#64748B]">Showing {rows.length===0?0:start+1}–{Math.min(start+PAGE_SIZE,rows.length)} of {rows.length}</p>
   <nav className="flex items-center gap-2" aria-label="Positions pagination"><button type="button" disabled={current===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#334155] disabled:cursor-not-allowed disabled:opacity-40">Previous</button><span className="px-2 text-xs tabular-nums text-[#64748B]">{current} / {pages}</span><button type="button" disabled={current===pages} onClick={()=>setPage(p=>Math.min(pages,p+1))} className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#334155] disabled:cursor-not-allowed disabled:opacity-40">Next</button></nav>
  </footer>
 </section>;
}
