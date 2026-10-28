import type {Metadata} from "next";
import Link from "next/link";

export const metadata:Metadata={title:"How it works | Zenvest",description:"See how to get started with Zenvest, choose a strategy, and follow your investments."};
const steps=[
 {number:"01",title:"Create your account",description:"Sign up with your email and set up your account in a few simple steps."},
 {number:"02",title:"Add money to your wallet",description:"When funding is available for your account, add USDC to your Zenvest wallet."},
 {number:"03",title:"Choose an investment",description:"Explore the available strategies, pick one you like, and choose how much to invest."},
 {number:"04",title:"Follow your progress",description:"See your wallet, investments, and results together in your Zenvest account."},
];
export default function HowItWorks(){
 return <main className="min-h-screen bg-[#F5F6FC] text-[#243553]">
  <section className="relative overflow-hidden bg-[#222D4D] text-white">
   <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_75%_110%_at_52%_0%,#6567A1_0%,#424E82_48%,#283558_100%)] [clip-path:ellipse(85%_95%_at_50%_0%)]"/>
   <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-20 sm:px-10 sm:pb-20 sm:pt-24">
    <header className="flex items-center justify-between gap-4"><Link href="/" className="text-3xl font-semibold tracking-[-.06em]">zenvest.</Link><Link href="/login" className="text-sm font-medium underline underline-offset-4">Log in</Link></header>
    <div className="mt-16"><p className="text-sm font-semibold uppercase tracking-[.08em] text-[#C5BCFF]">How it works</p><h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-[-.055em] sm:text-6xl">Investing with Zenvest, made simple.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[#CED6EC]">From creating your account to following your investments, here's how it all comes together.</p></div>
   </div>
  </section>
  <section className="mx-auto max-w-5xl px-6 py-14 sm:px-10 sm:py-20" aria-label="Getting started">
   <div className="grid gap-4 sm:grid-cols-2">{steps.map(step=><article key={step.number} className="rounded-[24px] border border-[#DFE5EF] bg-white p-6 sm:p-8"><span className="text-sm font-semibold text-[#716CC8]">{step.number}</span><h2 className="mt-5 text-2xl font-semibold tracking-[-.04em]">{step.title}</h2><p className="mt-3 text-base leading-7 text-[#586B84]">{step.description}</p></article>)}</div>
   <div className="mt-12 rounded-[24px] bg-[#E9ECFB] p-6 sm:p-10"><h2 className="text-2xl font-semibold tracking-[-.04em]">Everything in one place.</h2><p className="mt-3 max-w-2xl leading-7 text-[#586B84]">Your Overview shows your account balance. Wallet helps you manage your funds. Investments lets you explore strategies and see your activity.</p><Link href="/register" className="mt-7 inline-flex rounded-full bg-[#222D4D] px-7 py-3.5 font-semibold text-white hover:bg-[#36446B]">See your options →</Link></div>
  </section>
  <footer className="border-t border-[#DFE5EF] px-6 py-7 text-center text-sm text-[#586B84]"><Link href="/" className="mr-6 hover:underline">Home</Link><Link href="/terms" className="hover:underline">Terms of service</Link></footer>
 </main>;
}
