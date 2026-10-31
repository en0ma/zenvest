"use client";

import {useState} from "react";
import {ArrowUpRight, Check, Landmark, Layers3, Leaf, ChartNoAxesColumn, Info} from "lucide-react";

const choices=[
 {label:"Public stocks",icon:ChartNoAxesColumn},
 {label:"Funds",icon:Layers3},
 {label:"Real estate",icon:Landmark},
 {label:"Private credit",icon:Leaf},
 {label:"Zenvest",icon:Leaf},
];

export function HomeInvestmentDemo(){
 const [amount,setAmount]=useState(1000);
 return <div className="relative grid gap-0 lg:grid-cols-3">
  <div className="px-5 py-7 sm:px-8 lg:border-r lg:border-[#E0E6ED]">
   <div className="mb-5 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full border border-[#D8D5FF] bg-white text-sm font-semibold text-[#5549E8]">1</span><h3 className="text-lg font-semibold">Choose an option</h3></div>
   <p className="mb-5 min-h-12 text-sm leading-6 text-[#64748B]">Explore different investment options, all in one place.</p>
   <div className="overflow-hidden rounded-xl border border-[#E1E6EE] bg-white">
    {choices.map(({label,icon:Icon})=><div key={label} className={`flex items-center gap-3 border-b border-[#EEF1F6] px-4 py-3 text-sm last:border-0 ${label==="Zenvest"?"bg-[#F0EEFF] font-semibold text-[#5146D9]":"text-[#35445B]"}`}><Icon size={18} aria-hidden="true"/><span className="flex-1">{label}</span>{label==="Zenvest"?<Check size={17} aria-label="Selected"/>:<ArrowUpRight size={14} aria-hidden="true" className="text-[#8A97A9]"/>}</div>)}
   </div>
  </div>
  <div className="px-5 py-7 sm:px-8 lg:border-r lg:border-[#E0E6ED]">
   <div className="mb-5 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full border border-[#D8D5FF] bg-white text-sm font-semibold text-[#5549E8]">2</span><h3 className="text-lg font-semibold">Set an amount</h3></div>
   <p className="mb-5 min-h-12 text-sm leading-6 text-[#64748B]">Start with an amount that works for you.</p>
   <div className="rounded-xl border border-[#E1E6EE] bg-white p-5">
    <p className="text-center text-3xl font-semibold tracking-tight tabular-nums">{amount.toLocaleString("en-US")} <span className="text-base text-[#64748B]">USDC</span></p>
    <label htmlFor="home-amount" className="sr-only">Illustrative investment amount</label>
    <input id="home-amount" className="mt-6 w-full accent-[#635BFF]" type="range" min="100" max="10000" step="100" value={amount} onChange={e=>setAmount(Number(e.target.value))}/>
    <div className="mt-1 flex justify-between text-xs text-[#64748B]"><span>100</span><span>10,000</span></div>
   </div>
   <div className="mt-3 grid grid-cols-3 gap-2">{[500,1000,5000].map(n=><button type="button" key={n} aria-pressed={amount===n} onClick={()=>setAmount(n)} className={`rounded-lg border px-2 py-2 text-xs font-semibold tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635BFF] ${amount===n?"border-[#635BFF] bg-[#F0EEFF] text-[#5146D9]":"border-[#E1E6EE] bg-white text-[#35445B] hover:border-[#8F87FF]"}`}>{n.toLocaleString("en-US")}</button>)}</div>
  </div>
  <div className="px-5 py-7 sm:px-8">
   <div className="mb-5 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full border border-[#D8D5FF] bg-white text-sm font-semibold text-[#5549E8]">3</span><h3 className="text-lg font-semibold">Track your progress</h3></div>
   <p className="mb-5 min-h-12 text-sm leading-6 text-[#64748B]">Keep track of your investments and see your results over time.</p>
   <div className="rounded-xl border border-[#E1E6EE] bg-white p-4">
    <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">Your progress</span><span className="text-[10px] font-medium uppercase tracking-wider text-[#64748B]">Illustration</span></div>
    <svg className="mt-5 w-full" viewBox="0 0 300 125" role="img" aria-label="Decorative sample line showing changing investment activity; not actual or projected performance"><path d="M0 105H300 M0 70H300 M0 35H300" stroke="#E9EDF3" strokeWidth="1"/><path d="M0 87 C20 79 32 96 48 80 S81 75 100 63 S133 84 154 66 S188 51 208 63 S239 43 255 54 S286 27 300 38" fill="none" stroke="#635BFF" strokeWidth="3" strokeLinecap="round"/><circle cx="300" cy="38" r="5" fill="#635BFF"/></svg>
    <p className="mt-1 flex items-start gap-2 text-xs leading-5 text-[#64748B]"><Info size={15} className="mt-0.5 shrink-0" aria-hidden="true"/>Example visualization only. Not a forecast or promised return.</p>
   </div>
  </div>
 </div>
}