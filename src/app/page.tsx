import Link from "next/link";
import {ArrowRight, Layers3, SlidersHorizontal, ChartNoAxesColumnIncreasing} from "lucide-react";
import {MarketingFooter} from "@/components/marketing";

export default function Home(){
 return <><header className="relative z-20 bg-[#fcfaff]"><div className="mx-auto flex h-[77px] max-w-[1536px] items-center justify-between px-6 md:px-[6%]"><Link href="/" className="text-[32px] font-extrabold tracking-[-.085em] text-[#0f1032]">zenvest<span className="text-[#5207ec]">.</span></Link><nav className="hidden items-center gap-14 text-[17px] font-semibold text-[#14142b] md:flex" aria-label="Main navigation"><Link href="/earn">Invest</Link><Link href="/docs">Learn</Link><Link href="/about">About</Link></nav><div className="flex items-center gap-5 sm:gap-9"><Link href="/login" className="text-sm font-semibold text-[#14142b] sm:text-base">Log in</Link><Link href="/register" className="rounded-2xl bg-[#5309ed] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4010ba] sm:px-8 sm:text-base">Get started</Link></div></div></header>
 <main className="bg-white text-[#10112f]">
  <section id="opportunity" className="relative isolate overflow-hidden bg-[linear-gradient(105deg,#fff_0%,#fbf8ff_54%,#f3eaff_100%)]">
   <div aria-hidden="true" className="absolute bottom-0 right-[-5%] top-0 w-[65%] rounded-tl-[65%] bg-[#e8dcff] max-lg:opacity-30"/>
   <div className="relative mx-auto grid min-h-[540px] max-w-[1536px] items-center px-6 md:px-[6%] lg:grid-cols-[51%_49%] lg:py-7">
    <div className="relative z-10 py-10 lg:py-12">
     <p className="text-xs font-bold uppercase tracking-[.075em] text-[#550ce9] md:text-base">Alternative investing for everyday investors</p>
     <h1 className="mt-7 max-w-[700px] text-[clamp(3.1rem,5vw,5.1rem)] font-bold leading-[1.035] tracking-[-.072em]">Discover another way to put your money to work.</h1>
     <p className="mt-5 max-w-[605px] text-[clamp(1.05rem,1.7vw,1.55rem)] leading-[1.35] text-[#555d7d]">Access a strategy-driven investment opportunity with a simple, hands-off experience.</p>
     <Link href="/register" className="mt-9 inline-flex items-center gap-5 rounded-xl bg-[#5309ed] px-7 py-4 text-lg font-semibold text-white transition-colors hover:bg-[#4210bd]">Get started <ArrowRight size={20}/></Link>
    </div>
    <div aria-label="Portrait illustration accompanying the Zenvest welcome message" role="img" className="relative z-0 hidden h-[520px] w-full lg:block">
     <div className="absolute bottom-0 right-[-11%] top-[2%] w-full overflow-hidden rounded-tl-[60%] bg-[#e9dcff]">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=85')] bg-cover bg-center"/>
     </div>
    </div>
   </div>
  </section>
  <section id="how-it-works" className="bg-white px-5 py-11 sm:px-8 lg:py-12">
   <div className="mx-auto grid max-w-[1420px] gap-10 rounded-[30px] bg-[#f5f0fd] px-6 py-9 sm:px-12 lg:grid-cols-[49%_51%] lg:gap-0 lg:px-[4.6%] lg:py-11">
    <div className="lg:border-r lg:border-[#cbc4e7] lg:pr-12"><p className="text-sm font-bold uppercase tracking-[.05em] text-[#550ce9] sm:text-base">How it works</p><h2 className="mt-5 max-w-[590px] text-[clamp(2.2rem,3.9vw,3.9rem)] font-bold leading-[1.03] tracking-[-.068em]">You invest. Zenvest handles the strategy.</h2><p className="mt-5 max-w-[545px] text-[clamp(1rem,1.6vw,1.43rem)] leading-[1.35] text-[#555d7d]">You don’t need to follow the markets or make complex decisions. We run a systematic strategy that manages the investment activity for you.</p></div>
    <div className="flex flex-col justify-center gap-7 lg:pl-[12%]">
     <div className="flex items-start gap-6"><span className="flex size-[62px] shrink-0 items-center justify-center rounded-2xl bg-[#e9ddff] text-[#5109e8]"><Layers3 size={29}/></span><div><h3 className="text-xl font-bold tracking-[-.035em]">Choose your investment</h3><p className="mt-1 text-lg leading-[1.4] text-[#555d7d]">Get started with an amount that works for you.</p></div></div>
     <div className="flex items-start gap-6"><span className="flex size-[62px] shrink-0 items-center justify-center rounded-2xl bg-[#e9ddff] text-[#5109e8]"><SlidersHorizontal size={29}/></span><div><h3 className="text-xl font-bold tracking-[-.035em]">We handle the strategy</h3><p className="mt-1 text-lg leading-[1.4] text-[#555d7d]">A disciplined, rules-based approach manages the market activity.</p></div></div>
     <div className="flex items-start gap-6"><span className="flex size-[62px] shrink-0 items-center justify-center rounded-2xl bg-[#e9ddff] text-[#5109e8]"><ChartNoAxesColumnIncreasing size={29}/></span><div><h3 className="text-xl font-bold tracking-[-.035em]">Track your progress</h3><p className="mt-1 text-lg leading-[1.4] text-[#555d7d]">See how your investment is performing, anytime.</p></div></div>
    </div>
   </div>
  </section>
 </main><MarketingFooter/></>;
}
