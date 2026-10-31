"use client";
import {useState} from "react";
import {ArrowUpRight, Landmark, Layers3, Leaf, ChartNoAxesColumn, Info} from "lucide-react";

const choices=[
 {label:"Private credit",icon:Leaf},
 {label:"Real estate",icon:Landmark},
 {label:"Venture funds",icon:Layers3},
 {label:"Public stocks",icon:ChartNoAxesColumn},
 {label:"Zenvest",icon:Leaf},
];
export function HomeInvestmentDemo(){
 const [amount,setAmount]=useState(1000);
 return <div className="relative grid items-stretch gap-4 sm:grid-cols-3 sm:gap-3">
  <svg className="pointer-events-none absolute -top-6 left-0 hidden h-16 w-full sm:block" viewBox="0 0 900 70" preserveAspectRatio="none" aria-hidden="true"><path d="M45 56C130 0 204 0 295 50S460 88 540 35S726 7 855 42" stroke="#8F82E9" strokeWidth="1.7" fill="none"/></svg>
  <article className="relative rounded-2xl border border-[#E7EBF4] bg-white p-4 sm:mt-0 sm:p-5">
   <div className="absolute -top-4 left-4 flex size-9 items-center justify-center rounded-full bg-[#EEECFF] text-sm font-bold text-[#5549D9]">1</div>
   <h3 className="mt-4 text-base font-semibold">Choose an option</h3>
   <p className="mt-2 min-h-[66px] text-xs leading-5 text-[#627089]">Explore a range of investment options, all in one place.</p>
   <div className="mt-4 overflow-hidden rounded-lg border border-[#E6EAF3]">{choices.map(({label,icon:Icon})=><div key={label} className={`flex items-center gap-2 border-b border-[#EDF0F5] px-2.5 py-2 text-[11px] last:border-0 ${label==="Zenvest"?"bg-[#EEECFF] font-bold text-[#5948E2]":"text-[#40516B]"}`}><Icon size={15} aria-hidden="true"/><span className="flex-1">{label}</span><ArrowUpRight size={13} aria-hidden="true"/></div>)}</div>
  </article>
  <article className="relative rounded-2xl border border-[#E7EBF4] bg-white p-4 sm:mt-9 sm:p-5">
   <div className="absolute -top-4 left-4 flex size-9 items-center justify-center rounded-full bg-[#EEECFF] text-sm font-bold text-[#5549D9]">2</div>
   <h3 className="mt-4 text-base font-semibold">Start with an amount that works for you</h3>
   <p className="mt-2 min-h-[66px] text-xs leading-5 text-[#627089]">Explore an amount you're comfortable with.</p>
   <div className="mt-4 rounded-xl border border-[#E6EAF3] bg-white p-3">
    <p className="text-center text-xl font-bold tabular-nums">{amount.toLocaleString("en-US")} <span className="text-xs font-medium text-[#63728B]">USDC</span></p>
    <label htmlFor="home-amount" className="sr-only">Illustrative investment amount</label>
    <input id="home-amount" className="mt-4 w-full accent-[#635BFF]" type="range" min="100" max="10000" step="100" value={amount} onChange={e=>setAmount(Number(e.target.value))}/>
    <div className="flex justify-between text-[10px] text-[#697892]"><span>100</span><span>10,000</span></div>
   </div>
   <p className="mt-4 flex items-start gap-1.5 text-[10px] leading-4 text-[#63728B]"><Info size={13} className="mt-0.5 shrink-0"/>Example only — no investment is being made.</p>
  </article>
  <article className="relative rounded-2xl border border-[#E7EBF4] bg-white p-4 sm:mt-2 sm:p-5">
   <div className="absolute -top-4 left-4 flex size-9 items-center justify-center rounded-full bg-[#EEECFF] text-sm font-bold text-[#5549D9]">3</div>
   <h3 className="mt-4 text-base font-semibold">See your money in one place</h3>
   <p className="mt-2 min-h-[66px] text-xs leading-5 text-[#627089]">Keep track of your investments and see your results over time.</p>
   <div className="mt-4 rounded-xl border border-[#E6EAF3] bg-white p-3">
    <div className="flex justify-between gap-1"><span className="text-xs font-semibold">Your progress</span><span className="text-[9px] text-[#66758C]">Illustration</span></div>
    <svg className="mt-3 w-full" viewBox="0 0 240 125" role="img" aria-label="Illustrative investment activity line, not actual or projected returns"><path d="M0 103H240M0 68H240M0 33H240" stroke="#ECF0F7" fill="none"/><path d="M0 101C16 80 23 108 42 91S71 80 85 66S110 79 125 63S152 45 168 56S195 33 210 39S228 26 240 19V125H0Z" fill="#EEECFF"/><path d="M0 101C16 80 23 108 42 91S71 80 85 66S110 79 125 63S152 45 168 56S195 33 210 39S228 26 240 19" stroke="#635BFF" strokeWidth="2.5" fill="none" strokeLinecap="round"/><circle cx="240" cy="19" r="4" fill="#635BFF"/></svg>
    <div className="flex justify-between text-[9px] text-[#7B8798]"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div>
   </div>
  </article>
 </div>
}