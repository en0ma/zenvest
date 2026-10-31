import Link from "next/link";
import {ArrowRight, ArrowUpRight, ChartNoAxesColumn, Layers3, Landmark, Leaf, Check} from "lucide-react";
import {MarketingHeader, MarketingFooter} from "@/components/marketing";
import {HomeInvestmentDemo} from "@/components/home-investment-demo";

function Landscape(){
 return <div className="relative mx-auto w-full max-w-[780px]" aria-label="A winding trail passes public stocks, funds and real estate before reaching Zenvest">
  <svg viewBox="0 0 720 440" className="w-full" role="img" aria-label="Illustrated countryside path featuring familiar ways to invest, ending at Zenvest">
   <defs><linearGradient id="zen-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FEF9ED"/><stop offset="1" stopColor="#EFF4E6"/></linearGradient></defs>
   <rect width="720" height="440" fill="url(#zen-sky)"/>
   <circle cx="594" cy="92" r="43" fill="#F8E3AC" opacity=".8"/>
   <path d="M0 225 Q130 162 245 218 Q348 166 472 197 Q594 135 720 203V440H0Z" fill="#DCE6CB"/>
   <path d="M0 282 Q126 219 252 273 Q384 228 509 263 Q602 231 720 254V440H0Z" fill="#BBCFA7"/>
   <path d="M0 361 Q110 302 227 343 Q381 280 521 340 Q628 300 720 333V440H0Z" fill="#8FAB8C"/>
   <path d="M370 440 C408 390 491 379 467 324 S330 267 406 213 S596 197 566 135 S501 92 534 0" fill="none" stroke="#F8F5E9" strokeWidth="50" strokeLinecap="round"/>
   <path d="M370 440 C408 390 491 379 467 324 S330 267 406 213 S596 197 566 135 S501 92 534 0" fill="none" stroke="#8B7CE9" strokeWidth="3" strokeDasharray="4 11" strokeLinecap="round"/>
   <g fill="#648666"><path d="M73 353l20-71 20 71Z M80 323l13-77 13 77Z"/><rect x="90" y="348" width="6" height="30" fill="#897859"/><path d="M614 300l26-94 26 94Z M622 265l18-82 18 82Z"/><rect x="637" y="291" width="6" height="37" fill="#897859"/><path d="M174 252l15-54 15 54Z"/><rect x="187" y="246" width="4" height="20" fill="#897859"/><path d="M677 389l19-74 19 74Z"/><rect x="693" y="380" width="5" height="29" fill="#897859"/></g>
  </svg>
  <div className="absolute left-[48%] top-[12%] -translate-x-1/2 rounded-lg bg-white/95 px-3 py-2 text-xs text-[#425466] shadow-sm sm:text-sm"><ChartNoAxesColumn size={16} className="mb-1 text-[#0A2540]"/>Public stocks</div>
  <div className="absolute left-[71%] top-[33%] rounded-lg bg-white/95 px-3 py-2 text-xs text-[#425466] shadow-sm sm:text-sm"><Layers3 size={16} className="mb-1 text-[#0A2540]"/>Funds</div>
  <div className="absolute left-[37%] top-[49%] rounded-lg bg-white/95 px-3 py-2 text-xs text-[#425466] shadow-sm sm:text-sm"><Landmark size={16} className="mb-1 text-[#0A2540]"/>Real estate</div>
  <div className="absolute bottom-[11%] left-[55%] flex items-center gap-2 rounded-xl border border-[#BDB5FF] bg-white px-3 py-2 text-sm font-semibold text-[#5044D7] shadow-[0_5px_24px_rgba(60,50,130,.09)] sm:px-4 sm:py-3"><span className="flex size-7 items-center justify-center rounded-full bg-[#635BFF] text-white"><Leaf size={16}/></span>Zenvest <Check size={16}/></div>
 </div>
}
export default function Home(){
 return <><MarketingHeader/><main className="bg-[#FFFEFB] text-[#0A2540]">
  <section id="opportunity" className="relative overflow-hidden border-b border-[#E8E6DE] bg-[#FBFAF4]">
   <div className="mx-auto grid max-w-[1480px] items-center gap-10 px-6 py-16 sm:px-10 md:px-16 md:py-24 lg:grid-cols-[.86fr_1.14fr] lg:gap-10">
    <div className="relative z-10">
     <p className="text-xs font-semibold uppercase tracking-[.19em] text-[#635BFF]">A broader way to invest</p>
     <h1 className="mt-6 max-w-xl text-[clamp(3.3rem,6vw,6.15rem)] font-semibold leading-[1.01] tracking-[-.068em]">Explore more investment opportunities.</h1>
     <p className="mt-7 max-w-lg text-lg leading-8 text-[#536176]">Zenvest offers another way to invest, with a simple experience that makes it easier to explore your options and follow your money.</p>
     <div className="mt-8 flex flex-wrap items-center gap-3"><Link href="/register" className="inline-flex items-center gap-3 rounded-lg bg-[#635BFF] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#5146D9]">Get started <ArrowRight size={17}/></Link><Link href="#how-it-works" className="inline-flex items-center gap-2 rounded-lg border border-[#D7DCE7] bg-white px-6 py-3.5 text-sm font-semibold text-[#0A2540] hover:border-[#635BFF]">See how it works <ArrowUpRight size={16}/></Link></div>
     <p className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#536176]"><span className="flex items-center gap-1.5"><Check size={14} className="text-[#635BFF]"/>Simple to explore</span><span className="flex items-center gap-1.5"><Check size={14} className="text-[#635BFF]"/>Clear account information</span><span className="flex items-center gap-1.5"><Check size={14} className="text-[#635BFF]"/>Built around you</span></p>
    </div>
    <Landscape/>
   </div>
  </section>
  <section id="how-it-works" className="scroll-mt-24 bg-white px-6 py-16 sm:px-10 md:px-16 md:py-24">
   <div className="mx-auto max-w-7xl">
    <div className="text-center"><p className="text-xs font-semibold uppercase tracking-[.19em] text-[#635BFF]">How it works</p><h2 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-[-.05em] sm:text-4xl md:text-5xl">A simpler path to alternative investing.</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#536176]">Discover Zenvest, choose an amount and stay connected to your investment.</p></div>
    <div className="mt-12 rounded-2xl border border-[#E0E6ED] bg-[#FCFCFE]"><HomeInvestmentDemo/></div>
    <div className="mt-7 flex flex-wrap items-center justify-between gap-4 text-sm text-[#536176]"><p>Investments involve risk, including possible loss of capital. Returns are not guaranteed.</p><Link href="/docs" className="inline-flex items-center gap-2 font-semibold text-[#5549E8] hover:underline">Learn more about Zenvest <ArrowUpRight size={16}/></Link></div>
   </div>
  </section>
 </main><MarketingFooter/></>
}