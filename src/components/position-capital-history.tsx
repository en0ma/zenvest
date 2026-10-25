"use client";
import {useState} from "react";
type Request={id:string;kind:string;amount:string;status:string;date:string};
const PAGE_SIZE=10;
export function PositionCapitalHistory({requests}:{requests:Request[]}){
 const [page,setPage]=useState(1);
 const pages=Math.max(1,Math.ceil(requests.length/PAGE_SIZE));
 const current=Math.min(page,pages),start=(current-1)*PAGE_SIZE;
 return <section className="overflow-hidden rounded-2xl border border-[#35404E] bg-[#202934] text-white">
  <header className="border-b border-white/10 px-5 py-5 sm:px-7"><h2 className="text-lg font-semibold">Position trades</h2><p className="mt-1 text-xs text-[#A6B3C5]">Allocation and deallocation transactions</p></header>
  <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#293545] text-xs text-[#A6B3C5]"><tr>{["Type","Amount (USDC)","Status","Date","ID"].map(h=><th key={h} className="whitespace-nowrap px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-white/10">{requests.slice(start,start+PAGE_SIZE).map(x=><tr key={x.id}><td className={"whitespace-nowrap px-5 py-4 font-semibold "+(x.kind==="ALLOCATE"?"text-emerald-300":"text-orange-300")}>{x.kind}</td><td className="whitespace-nowrap px-5 py-4 tabular-nums">{x.kind==="DEALLOCATE"?"−":"+"}{x.amount}</td><td className="whitespace-nowrap px-5 py-4 text-[#C6D0DD]">{x.status}</td><td className="whitespace-nowrap px-5 py-4 text-[#A6B3C5]">{x.date}</td><td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-[#A6B3C5]">{x.id}</td></tr>)}</tbody></table>{requests.length===0&&<p className="p-7 text-sm text-[#A6B3C5]">No allocation or deallocation transactions yet.</p>}</div>
  <footer className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-7"><p className="text-xs text-[#A6B3C5]">Showing {requests.length===0?0:start+1}–{Math.min(start+PAGE_SIZE,requests.length)} of {requests.length}</p><div className="flex items-center gap-3"><button type="button" disabled={current===1} onClick={()=>setPage(n=>Math.max(1,n-1))} className="rounded-lg border border-[#536176] px-3 py-2 text-sm disabled:opacity-40" aria-label="Previous page">Previous</button><span className="text-xs tabular-nums">{current} / {pages}</span><button type="button" disabled={current===pages} onClick={()=>setPage(n=>Math.min(pages,n+1))} className="rounded-lg border border-[#536176] px-3 py-2 text-sm disabled:opacity-40" aria-label="Next page">Next</button></div></footer>
 </section>;
}
