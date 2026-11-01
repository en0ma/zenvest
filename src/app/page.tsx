import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {MarketingFooter} from "@/components/marketing";

/** A single editorial hero, based on the approved Zenvest reference. */
export default function Home(){
 return <><header className="relative z-20 bg-[#FCFAFF]">
  <div className="mx-auto flex h-[84px] max-w-[1536px] items-center justify-between gap-4 px-6 md:px-[6%]">
   <Link href="/" aria-label="Zenvest home" className="text-[30px] font-extrabold tracking-[-.075em] text-[#14253D]">zenvest<span className="text-[#5207EC]">.</span></Link>
   <nav aria-label="Main navigation" className="hidden items-center gap-14 text-base font-medium text-[#14253D] md:flex">
    <Link href="/earn" className="hover:text-[#5207EC]">Invest</Link><Link href="/docs" className="hover:text-[#5207EC]">Learn</Link><Link href="/about" className="hover:text-[#5207EC]">About</Link>
   </nav>
   <div className="flex items-center gap-4 sm:gap-10"><Link href="/login" className="text-sm font-medium text-[#14253D] hover:text-[#5207EC] sm:text-base">Log in</Link><Link href="/register" className="rounded-2xl bg-[#5207EC] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4010BA] sm:px-8 sm:text-base">Get started</Link></div>
  </div>
 </header>
 <main className="bg-[#FCFAFF] text-[#14253D]">
  <section id="opportunity" aria-labelledby="hero-title" className="relative isolate min-h-[calc(100svh-84px)] overflow-hidden bg-[linear-gradient(110deg,#FFFDFF_0%,#FCF8FF_53%,#F4ECFF_100%)]">
   <div aria-hidden="true" className="pointer-events-none absolute bottom-[-35%] right-[-20%] h-[100%] w-[95%] rotate-[-18deg] rounded-[50%] bg-[#E7D8FF]/50 lg:right-[-27%]"/>
   <div aria-hidden="true" className="pointer-events-none absolute bottom-[-65%] left-[10%] h-[85%] w-[95%] rotate-[-24deg] rounded-[50%] bg-[#EADFFF]/45"/>
   <div className="relative mx-auto grid min-h-[calc(100svh-84px)] max-w-[1536px] items-center px-6 md:px-[6%] lg:grid-cols-[54%_46%]">
    <div className="relative z-10 pb-10 pt-14 lg:pb-20 lg:pt-12">
     <p className="text-xs font-bold uppercase tracking-[.055em] text-[#5207EC] sm:text-base">Alternative investing for everyday investors</p>
     <h1 id="hero-title" className="mt-10 max-w-[760px] text-[clamp(3.15rem,5.1vw,5.15rem)] font-bold leading-[1.035] tracking-[-.075em]">Discover another way to put your money to work.</h1>
     <p className="mt-7 max-w-[665px] text-[clamp(1.08rem,1.75vw,1.55rem)] leading-[1.35] text-[#52627B]">Access a different kind of investment opportunity. Choose how much to invest, while Zenvest handles the strategy behind the scenes.</p>
     <Link href="/register" className="mt-12 inline-flex items-center justify-center gap-6 rounded-2xl bg-[#5207EC] px-9 py-4 text-lg font-semibold text-white transition-colors hover:bg-[#4010BA] focus-visible:outline-offset-4">Get started <ArrowRight size={23} aria-hidden="true"/></Link>
    </div>
    <div className="relative -mx-6 min-h-[350px] self-end sm:min-h-[490px] md:-mx-[6vw] lg:mx-0 lg:h-full lg:min-h-[680px]" role="img" aria-label="Portrait of a confident Black woman wearing a purple top">
     <div aria-hidden="true" className="absolute bottom-[-10%] right-[-20%] h-[95%] w-[130%] rounded-tl-[85%] bg-[#E6D6FF]/80"/>
     <div aria-hidden="true" className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=1200&q=90')] bg-contain bg-bottom bg-no-repeat"/>
    </div>
   </div>
  </section>
 </main><MarketingFooter/></>;
}
