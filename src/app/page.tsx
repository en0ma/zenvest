import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {MarketingFooter} from "@/components/marketing";

/**
 * One-section homepage. Reference: approved 1536 × 1024 screenshot (2026-11-01).
 * The portrait is cropped from the user's approved screenshot and stored locally.
 * The reference screenshot was 1536x1024; responsive layouts are adaptations.
 */
export default function Home(){
 return <div className="lg:flex lg:h-[100dvh] lg:flex-col lg:overflow-hidden">
  <header className="relative z-20 shrink-0 bg-[#FBF8FF]">
   <div className="mx-auto flex h-[98px] max-w-[1536px] items-center justify-between px-6 sm:px-10 lg:px-[5.9%]">
    <Link href="/" aria-label="Zenvest home" className="shrink-0 text-[31px] font-extrabold tracking-[-.072em] text-[#14253D]">zenvest<span className="text-[#5400ED]">.</span></Link>
    <nav className="hidden items-center gap-[70px] text-[20px] font-medium text-[#14253D] md:flex" aria-label="Main navigation">
     <Link href="/earn" className="hover:text-[#5400ED]">Invest</Link>
     <Link href="/docs" className="hover:text-[#5400ED]">Learn</Link>
     <Link href="/about" className="hover:text-[#5400ED]">About</Link>
    </nav>
    <div className="flex items-center gap-4 sm:gap-12">
     <Link href="/login" className="text-sm font-medium text-[#14253D] hover:text-[#5400ED] sm:text-[20px]">Log in</Link>
     <Link href="/register" className="rounded-[20px] bg-[#5200E9] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4000B6] sm:px-7 sm:text-[18px]">Get started</Link>
    </div>
   </div>
  </header>
  <main className="min-h-0 bg-[#FCF9FF] lg:flex-1">
   <section id="opportunity" aria-labelledby="zenvest-hero-title" className="relative isolate min-h-[720px] overflow-hidden bg-[linear-gradient(113deg,#FCFAFF_0%,#FBF8FF_49%,#F5EAFF_100%)] lg:h-full lg:min-h-0">
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-[61%] left-[12%] h-[90%] w-[105%] -rotate-[24deg] rounded-[50%] bg-[#E2D4FF]/45"/>
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-[47%] right-[-29%] h-[117%] w-[93%] -rotate-[27deg] rounded-[50%] bg-[#E9D9FF]/70"/>
    <div className="relative mx-auto h-full max-w-[1536px]">
     <div className="relative z-10 px-6 pb-5 pt-16 sm:px-10 lg:absolute lg:left-[5.9%] lg:top-[clamp(36px,12vh,137px)] lg:w-[51%] lg:px-0 lg:pt-0">
      <p className="text-[11px] font-bold uppercase tracking-[.06em] text-[#5100E9] sm:text-base lg:text-[18px]">Alternative investing for everyday investors</p>
      <h1 id="zenvest-hero-title" className="mt-11 max-w-[735px] text-[clamp(3rem,5vw,4.65rem)] font-bold leading-[.99] tracking-[-.065em] text-[#14253D]">Discover another way to put your money to work.</h1>
      <p className="mt-8 max-w-[670px] text-[clamp(1.125rem,1.8vw,1.625rem)] leading-[1.25] text-[#52627B]">Access a different kind of investment opportunity. Choose how much to invest, while Zenvest handles the strategy behind the scenes.</p>
      <Link href="/register" className="mt-12 inline-flex items-center justify-center gap-7 rounded-[18px] bg-[#5200E9] px-10 py-[18px] text-[21px] font-semibold text-white transition-colors hover:bg-[#4000B6] focus-visible:outline-offset-4">Get started <ArrowRight aria-hidden="true" size={26}/></Link>
     </div>
     <div className="relative mx-auto mt-2 h-[420px] w-full sm:h-[560px] lg:absolute lg:bottom-0 lg:right-0 lg:mt-0 lg:h-full lg:w-[55.73%]" role="img" aria-label="The approved Zenvest hero portrait of a Black woman wearing a purple sweater">
      <div aria-hidden="true" className="absolute inset-0 bg-[url('/approved-portrait.webp')] bg-contain bg-right-bottom bg-no-repeat [clip-path:inset(0_0_0_19%)]"/>
     </div>
    </div>
    <footer className="absolute bottom-0 left-0 right-0 z-20 hidden min-h-[40px] items-center justify-center gap-x-5 gap-y-1 bg-[#FBF8FF]/90 px-5 py-2 text-[11px] text-[#52627B] lg:flex lg:flex-wrap"><span>Capital at risk. No guaranteed returns. Zenvest is not currently accepting investments.</span><Link href="/terms" className="underline">Terms</Link><Link href="/privacy" className="underline">Privacy</Link><Link href="/risk" className="underline">Risk disclosure</Link></footer>
   </section>
  </main>
  <div className="lg:hidden"><MarketingFooter/></div>
 </div>;
}
