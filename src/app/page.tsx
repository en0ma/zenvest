import Link from "next/link";
import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth";

function AccountPreview(){
 return <div className="rounded-[28px] bg-white px-5 py-6 text-[#263957] shadow-[0_20px_60px_rgba(10,15,33,.12)] sm:px-7 sm:py-7" aria-label="Illustrative Zenvest account interface preview">
  <div className="flex flex-wrap items-baseline justify-between gap-2"><strong className="text-[21px] font-semibold tracking-[-.035em] sm:text-2xl">Your Zenvest account</strong><span className="text-sm text-[#8490A0] sm:text-base">Account overview</span></div>
  <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm sm:text-base"><div className="rounded-xl bg-[#2B4063] px-2 py-3 font-medium text-white">Overview</div><div className="rounded-xl bg-[#EEF1F7] px-2 py-3 text-[#61708A]">Wallet</div><div className="rounded-xl bg-[#EEF1F7] px-2 py-3 text-[#61708A]">Investments</div></div>
  <p className="mt-6 text-xs font-medium uppercase tracking-[.035em] text-[#8591A1] sm:text-sm">Total account balance</p>
  <div className="mt-3 text-[36px] font-semibold leading-none tracking-[-.04em] tabular-nums sm:text-[43px]">$5,240.00</div>
  <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-[#D8E1EB]"><div className="w-[76.34%] bg-[#7D80DB]"/></div>
  <div className="mt-4 flex justify-between gap-4"><div><p className="text-sm text-[#8591A1]">Invested</p><p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">$4,000</p></div><div className="text-right"><p className="text-sm text-[#8591A1]">Available</p><p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">$1,240</p></div></div>
 </div>;
}
export default async function Home(){
 const session=await getServerSession(authOptions);
 return <main className="min-h-screen bg-[#08090D] px-3 py-5 text-white sm:px-6 sm:py-10">
  <section className="relative mx-auto max-w-[1100px] overflow-hidden rounded-[30px] bg-[#222D4D] sm:rounded-[42px]">
   <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[120px] bg-[radial-gradient(ellipse_at_50%_0%,#51538B_0%,#343F6A_65%,#253052_100%)]"/>
   <div aria-hidden="true" className="pointer-events-none absolute left-[-8%] top-[55px] h-[85px] w-[116%] rounded-[0_0_50%_50%] bg-[#222D4D]"/>
   <div className="relative px-5 pb-7 pt-[112px] sm:px-10 sm:pb-12 sm:pt-[125px] lg:px-16">
    <header className="flex items-center justify-between gap-4">
     <Link href="/" className="text-[29px] font-bold tracking-[-.06em] sm:text-[34px]">zenvest.</Link>
     <Link href={session?.user?.id?"/dashboard":"/register"} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#253351] sm:px-6 sm:text-base">{session?.user?.id?"My account":"Get started"}</Link>
    </header>
    <div className="mt-14 sm:mt-20">
     <p className="text-xs font-semibold uppercase tracking-[.045em] text-[#BDB5FF] sm:text-sm">Discover something new</p>
     <h1 className="mt-6 max-w-[850px] text-[clamp(2.7rem,7vw,5.8rem)] font-semibold leading-[1.12] tracking-[-.055em]">Your money. More<br className="hidden sm:block"/> possibilities.</h1>
     <p className="mt-6 max-w-[740px] text-[clamp(1.04rem,2.5vw,1.75rem)] leading-[1.48] text-[#CAD1E8]">There's more than one way to invest. Explore new opportunities with Zenvest.</p>
     <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-4">
      <Link href={session?.user?.id?"/earn":"/register"} className="inline-flex items-center gap-3 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-[#253351] sm:px-8 sm:py-4 sm:text-lg">See your options <span aria-hidden="true">→</span></Link>
      <Link href="/docs" className="text-base font-medium text-white underline underline-offset-4 sm:text-lg">How it works</Link>
     </div>
    </div>
    <div className="mt-12 sm:mt-16"><AccountPreview/></div>
    <p className="mt-7 max-w-[740px] text-sm leading-6 text-[#ADB8D6] sm:mt-9 sm:text-base">Discover a strategy. Fund your wallet. Choose an amount.<br className="hidden sm:block"/> Stay informed.</p>
   </div>
  </section>
  <footer className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-center gap-x-7 gap-y-3 px-5 py-8 text-sm text-[#B3BCD3]">
   <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">Twitter</a>
   <a href="https://t.me" target="_blank" rel="noopener noreferrer" className="hover:text-white">Telegram</a>
   <Link href="/terms" className="hover:text-white">Terms of service</Link>
  </footer>
 </main>;
}
