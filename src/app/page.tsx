import Link from "next/link";
import {ArrowRight, ArrowUpRight, ChartNoAxesColumn, Layers3, House, Leaf, ShieldCheck, Users} from "lucide-react";
import {MarketingHeader, MarketingFooter} from "@/components/marketing";
import {HomeInvestmentDemo} from "@/components/home-investment-demo";

function MountainPath(){
 return <div className="absolute bottom-[64px] right-0 h-[340px] w-full overflow-hidden sm:bottom-[55px] sm:h-[440px] lg:inset-y-0 lg:h-full lg:w-[72%]" aria-label="An illustrated journey from familiar investments to Zenvest">
  <div className="absolute inset-0 bg-[url('/home-investment-landscape.svg')] bg-cover bg-center lg:bg-[length:100%_100%]" aria-hidden="true"/>
  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet" role="img" aria-label="A winding violet line connects stocks, funds and real estate and finishes at Zenvest">
   <path d="M45 255C130 195 170 222 230 275S340 365 415 304S496 219 567 255S645 245 703 170S754 139 795 116" fill="none" stroke="#F9F8FF" strokeWidth="6" strokeLinecap="round"/>
   <path d="M45 255C130 195 170 222 230 275S340 365 415 304S496 219 567 255S645 245 703 170S754 139 795 116" fill="none" stroke="#7161E8" strokeWidth="2.8" strokeLinecap="round"/>
  </svg>
  <div className="absolute left-[20%] top-[42%] flex -translate-x-1/2 flex-col items-center text-center"><span className="flex size-10 items-center justify-center rounded-full bg-white text-[#142C56] shadow-sm sm:size-12"><ChartNoAxesColumn size={20}/></span><span className="mt-1 text-xs font-semibold text-[#142C56]">Stocks</span><span className="text-[10px] text-[#546784]">Public companies</span></div>
  <div className="absolute left-[42%] top-[58%] flex -translate-x-1/2 flex-col items-center text-center"><span className="flex size-10 items-center justify-center rounded-full bg-white text-[#142C56] shadow-sm sm:size-12"><Layers3 size={20}/></span><span className="mt-1 text-xs font-semibold text-[#142C56]">Funds</span><span className="text-[10px] text-[#546784]">Diversified exposure</span></div>
  <div className="absolute left-[69%] top-[41%] flex -translate-x-1/2 flex-col items-center text-center"><span className="flex size-10 items-center justify-center rounded-full bg-white text-[#142C56] shadow-sm sm:size-12"><House size={20}/></span><span className="mt-1 text-xs font-semibold text-[#142C56]">Real estate</span><span className="text-[10px] text-[#546784]">Tangible assets</span></div>
  <div className="absolute right-[5%] top-[20%] flex flex-col items-center text-center"><span className="flex size-12 items-center justify-center rounded-full bg-[#5744E9] text-white shadow-[0_0_0_7px_rgba(99,91,255,.1)]"><Leaf size={24}/></span><span className="mt-2 text-sm font-bold text-[#4D39D2]">Zenvest</span><span className="text-[10px] text-[#546784]">Another way to invest</span></div>
 </div>
}

export default function Home(){
 return <><MarketingHeader/><main className="bg-white text-[#0A2540]">
  <section id="opportunity" className="relative isolate overflow-hidden bg-[#F8F9FD]">
   <MountainPath/>
   <div className="relative z-10 mx-auto max-w-[1440px] px-6 pt-14 sm:px-10 md:px-16 lg:min-h-[565px] lg:pt-24">
    <div className="max-w-[490px]">
     <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#5948E2]">A broader way to invest</p>
     <h1 className="mt-6 text-[clamp(3.1rem,5.1vw,5.35rem)] font-semibold leading-[.99] tracking-[-.064em]">A simpler way to explore alternative investments.</h1>
     <p className="mt-6 max-w-[455px] text-base leading-7 text-[#526177] sm:text-lg sm:leading-8">Zenvest helps everyday investors discover options beyond the usual — with a clear, modern experience designed to make investing feel easier to understand.</p>
     <div className="mt-7 flex flex-wrap gap-3"><Link href="/register" className="inline-flex items-center justify-center gap-3 rounded-lg bg-[#5744EB] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#4934DA]">Get started <ArrowRight size={16}/></Link><Link href="#how-it-works" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#D1D8EA] bg-white px-6 py-3.5 text-sm font-semibold text-[#0A2540] hover:border-[#8276DF]">See your options</Link></div>
    </div>
    <div className="mt-[340px] flex flex-wrap gap-x-7 gap-y-3 pb-8 text-xs text-[#53637D] sm:mt-[440px] lg:mt-12 lg:pb-10"><span className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#5744EB]"/>Clear information</span><span className="flex items-center gap-2"><ChartNoAxesColumn size={17} className="text-[#5744EB]"/>More investment options</span><span className="flex items-center gap-2"><Users size={17} className="text-[#5744EB]"/>Built for everyday investors</span></div>
   </div>
  </section>
  <section id="how-it-works" className="scroll-mt-24 bg-white px-6 py-16 sm:px-10 md:px-16 md:py-24">
   <div className="mx-auto grid max-w-[1340px] gap-12 lg:grid-cols-[.36fr_.64fr] lg:items-start lg:gap-10">
    <div className="lg:pt-10"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#5948E2]">How it works</p><h2 className="mt-6 text-4xl font-semibold leading-[1.06] tracking-[-.06em] sm:text-5xl">A clearer path to alternative investing.</h2><p className="mt-6 text-base leading-7 text-[#5B6880] sm:text-lg sm:leading-8">Zenvest makes it easy to explore new investment opportunities, with a straightforward experience built for people who want more choice and a simpler way to put their money to work.</p><Link href="/docs" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#5744EB] hover:underline">Learn more about Zenvest <ArrowRight size={16}/></Link></div>
    <HomeInvestmentDemo/>
   </div>
   <div className="mx-auto mt-10 max-w-[1340px] border-t border-[#E9EDF5] pt-5 text-xs leading-6 text-[#627089]"><ShieldCheck size={14} className="mr-2 inline text-[#635BFF]"/>Illustrations are not actual returns or projections. Investing involves risk, including possible loss of capital. Returns are not guaranteed.</div>
  </section>
 </main><MarketingFooter/></>
}