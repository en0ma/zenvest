import Link from "next/link";
import {ArrowRight, ChartNoAxesColumn, Layers3, House, Leaf} from "lucide-react";
import {MarketingHeader, MarketingFooter} from "@/components/marketing";
import {HomeInvestmentDemo} from "@/components/home-investment-demo";

function InvestmentTrail(){
 return <div className="pointer-events-none relative h-[370px] w-full select-none overflow-hidden sm:h-[480px] lg:absolute lg:inset-y-0 lg:right-0 lg:h-full lg:w-[72%]" role="img" aria-label="A curved violet trail across mountains and a lake connects Stocks, Funds, Real estate and ends at Zenvest">
  <div className="absolute inset-0 bg-[url('/home-investment-landscape.svg')] bg-cover bg-[center_48%] lg:bg-[length:100%_100%]" />
  <svg className="absolute inset-0 size-full" viewBox="0 0 840 570" preserveAspectRatio="none" aria-hidden="true"><path d="M45 276 C134 216 194 231 264 302 S387 399 483 316 S597 238 650 266 S737 240 802 139" fill="none" stroke="#FDFCFF" strokeWidth="6" strokeLinecap="round"/><path d="M45 276 C134 216 194 231 264 302 S387 399 483 316 S597 238 650 266 S737 240 802 139" fill="none" stroke="#6652ED" strokeWidth="2.5" strokeLinecap="round"/></svg>
  <div className="absolute left-[23%] top-[40%] flex -translate-x-1/2 flex-col items-center gap-1 text-center"><div className="flex size-11 items-center justify-center rounded-full bg-white text-[#10284A] shadow-[0_2px_8px_rgba(20,37,64,.06)]"><ChartNoAxesColumn size={19}/></div><b className="text-xs text-[#10284A]">Stocks</b><span className="text-[10px] text-[#586985]">Public companies</span></div>
  <div className="absolute left-[46%] top-[57%] flex -translate-x-1/2 flex-col items-center gap-1 text-center"><div className="flex size-11 items-center justify-center rounded-full bg-white text-[#10284A] shadow-[0_2px_8px_rgba(20,37,64,.06)]"><Layers3 size={19}/></div><b className="text-xs text-[#10284A]">Funds</b><span className="text-[10px] text-[#586985]">Diversified exposure</span></div>
  <div className="absolute left-[76%] top-[43%] flex -translate-x-1/2 flex-col items-center gap-1 text-center"><div className="flex size-11 items-center justify-center rounded-full bg-white text-[#10284A] shadow-[0_2px_8px_rgba(20,37,64,.06)]"><House size={19}/></div><b className="text-xs text-[#10284A]">Real estate</b><span className="text-[10px] text-[#586985]">Tangible assets</span></div>
  <div className="absolute right-[2.5%] top-[19%] flex flex-col items-center gap-1 text-center"><div className="flex size-12 items-center justify-center rounded-full bg-[#5241E8] text-white shadow-[0_0_0_6px_rgba(111,93,235,.10)]"><Leaf size={23}/></div><b className="mt-1 text-sm text-[#4E37D0]">Zenvest</b><span className="max-w-24 text-[11px] leading-4 text-[#586985]">Another way<br/>to invest</span></div>
 </div>
}

export default function Home(){
 return <><MarketingHeader/><main className="bg-white text-[#090B26]">
  <section id="opportunity" className="relative isolate overflow-hidden bg-[#F9FAFF]">
   <div className="relative mx-auto max-w-[1440px] lg:min-h-[594px]">
    <div className="relative z-10 px-6 pt-14 sm:px-10 md:px-16 lg:w-[45%] lg:pt-20">
     <p className="text-[11px] font-bold uppercase tracking-[.23em] text-[#5742E9]">A broader way to invest</p>
     <h1 className="mt-6 max-w-[485px] text-[clamp(3.35rem,5.4vw,5.55rem)] font-semibold leading-[.98] tracking-[-.07em]">A simpler way to explore alternative investments.</h1>
     <p className="mt-6 max-w-[465px] text-[17px] leading-[1.5] text-[#58647C]">Zenvest helps everyday investors discover options beyond the usual — with a clear, modern experience designed to make investing feel easier to understand.</p>
     <div className="mt-7 flex flex-wrap gap-3"><Link href="/register" className="inline-flex items-center justify-center gap-3 rounded-lg bg-[#5438F0] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#442BCE]">Get started <ArrowRight size={16}/></Link><Link href="#how-it-works" className="inline-flex items-center justify-center rounded-lg border border-[#D5D9EC] bg-white px-7 py-3.5 text-sm font-semibold text-[#0A2540] hover:border-[#8277DC]">See your options</Link></div>
    </div>
    <div className="lg:hidden"><InvestmentTrail/></div>
    <div className="hidden lg:block"><InvestmentTrail/></div>
   </div>
  </section>
  <section id="how-it-works" className="scroll-mt-24 bg-white px-6 pb-20 pt-14 sm:px-10 md:px-16 md:pb-24">
   <div className="mx-auto grid max-w-[1320px] gap-12 lg:grid-cols-[.32fr_.68fr] lg:gap-14">
    <div className="lg:pt-5"><p className="text-[11px] font-bold uppercase tracking-[.23em] text-[#5742E9]">How it works</p><h2 className="mt-6 text-[clamp(2.6rem,4vw,4.2rem)] font-semibold leading-[1.02] tracking-[-.067em]">A clearer path to alternative investing.</h2><p className="mt-6 max-w-[415px] text-base leading-[1.6] text-[#5C6982]">Zenvest makes it easy to explore new investment opportunities, with a straightforward experience built for people who want more choice and a simpler way to put their money to work.</p><Link href="/docs" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#5438F0] hover:underline">Learn more about Zenvest <ArrowRight size={16}/></Link></div>
    <HomeInvestmentDemo/>
   </div>
   <p className="mx-auto mt-10 max-w-[1320px] border-t border-[#EDF0F7] pt-5 text-xs leading-5 text-[#6D7A90]">Illustrative experience only. This chart does not show actual or forecast investment returns. Investments carry risk, including loss of capital.</p>
  </section>
 </main><MarketingFooter/></>
}