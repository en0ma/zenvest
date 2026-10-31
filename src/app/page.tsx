import Link from "next/link";
/* eslint-disable @next/next/no-img-element -- local SVG illustration is decorative and scales naturally */
import {ArrowRight, ArrowUpRight, ChartNoAxesColumn, Layers3, Landmark, Leaf, Check} from "lucide-react";
import {MarketingHeader, MarketingFooter} from "@/components/marketing";
import {HomeInvestmentDemo} from "@/components/home-investment-demo";

function Landscape(){
 return <div className="relative mx-auto w-full max-w-[800px] overflow-hidden" aria-label="Illustrated investment pathway ending at Zenvest">
  <img src="/home-investment-landscape.svg" alt="" aria-hidden="true" className="block h-auto w-full select-none" />
  <div className="absolute left-[48%] top-[12%] flex items-center gap-1.5 text-[10px] font-medium text-[#27364A] sm:text-xs">Public stocks <ChartNoAxesColumn size={15} aria-hidden="true"/></div>
  <div className="absolute left-[40%] top-[30%] flex items-center gap-1.5 text-[10px] font-medium text-[#27364A] sm:text-xs">Real estate <Landmark size={15} aria-hidden="true"/></div>
  <div className="absolute left-[46%] top-[49%] flex items-center gap-1.5 text-[10px] font-medium text-[#27364A] sm:text-xs">Funds <Layers3 size={15} aria-hidden="true"/></div>
  <div className="absolute left-[35%] top-[67%] flex items-center gap-1.5 text-[10px] font-medium text-[#27364A] sm:text-xs">Private credit <Leaf size={15} aria-hidden="true"/></div>
  <div className="absolute bottom-[4%] left-[56%] flex items-center gap-2 text-base font-semibold text-[#4536CE] sm:text-xl"><span className="flex size-10 items-center justify-center rounded-full bg-[#5544E8] text-white sm:size-12"><Leaf size={23} aria-hidden="true"/></span>Zenvest <Check size={15} aria-label="Selected"/></div>
 </div>
}
export default function Home(){
 return <><MarketingHeader/><main className="bg-[#FFFEFB] text-[#0A2540]">
  <section id="opportunity" className="relative overflow-hidden border-b border-[#E8E6DE] bg-[#FBFAF4]">
   <div className="mx-auto grid max-w-[1480px] items-center gap-2 px-6 pt-12 pb-2 sm:px-10 md:px-16 md:pt-16 lg:grid-cols-[.76fr_1.24fr] lg:gap-0">
    <div className="relative z-10">
     <p className="text-xs font-semibold uppercase tracking-[.19em] text-[#635BFF]">A broader way to invest</p>
     <h1 className="mt-6 max-w-xl text-[clamp(3.1rem,5vw,5.4rem)] font-semibold leading-[1.01] tracking-[-.068em]">Explore more investment opportunities.</h1>
     <p className="mt-7 max-w-lg text-lg leading-8 text-[#536176]">Zenvest helps everyday investors explore new opportunities — with a clear, modern experience designed to make investing feel easier to understand.</p>
     <div className="mt-8 flex flex-wrap items-center gap-3"><Link href="/register" className="inline-flex items-center gap-3 rounded-lg bg-[#635BFF] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#5146D9]">Get started <ArrowRight size={17}/></Link><Link href="#how-it-works" className="inline-flex items-center gap-2 rounded-lg border border-[#D7DCE7] bg-white px-6 py-3.5 text-sm font-semibold text-[#0A2540] hover:border-[#635BFF]">See your options <ArrowUpRight size={16}/></Link></div>
     <p className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#536176]"><span className="flex items-center gap-1.5"><Check size={14} className="text-[#635BFF]"/>Simple to explore</span><span className="flex items-center gap-1.5"><Check size={14} className="text-[#635BFF]"/>Clear account information</span><span className="flex items-center gap-1.5"><Check size={14} className="text-[#635BFF]"/>Built around you</span></p>
    </div>
    <Landscape/>
   </div>
  </section>
  <section id="how-it-works" className="scroll-mt-24 bg-white px-6 py-16 sm:px-10 md:px-16 md:py-24">
   <div className="mx-auto max-w-7xl">
    <div className="text-center"><p className="text-xs font-semibold uppercase tracking-[.19em] text-[#635BFF]">How it works</p><h2 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-[-.05em] sm:text-4xl md:text-5xl">A simpler path to alternative investing.</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#536176]">Three simple steps to explore investment opportunities, all in one place.</p></div>
    <div className="mt-10 rounded-2xl border border-[#E6E8EF] bg-[#FFFEFD]"><HomeInvestmentDemo/></div>
    <div className="mt-7 flex flex-wrap items-center justify-between gap-4 text-sm text-[#536176]"><p>Investments involve risk, including possible loss of capital. Returns are not guaranteed.</p><Link href="/docs" className="inline-flex items-center gap-2 font-semibold text-[#5549E8] hover:underline">Learn more about Zenvest <ArrowUpRight size={16}/></Link></div>
   </div>
  </section>
 </main><MarketingFooter/></>
}