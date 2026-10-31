import Link from "next/link";
import {ArrowRight, ArrowUpRight, ChartNoAxesColumn, Layers3, Landmark, Leaf, Check} from "lucide-react";
import {MarketingHeader, MarketingFooter} from "@/components/marketing";
import {HomeInvestmentDemo} from "@/components/home-investment-demo";

function Landscape(){
 return <div className="relative isolate mx-auto w-full max-w-[830px] overflow-hidden lg:overflow-visible">
  <svg viewBox="0 0 780 530" className="w-full" role="img" aria-label="A violet walking trail winds through green hills past public stocks, real estate, funds and private credit, ending at the selected Zenvest">
   <defs>
    <linearGradient id="countrySky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#FBF9F0"/><stop offset="1" stopColor="#F5F6E8"/></linearGradient>
    <linearGradient id="countryGround" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#E9ECCF"/><stop offset="1" stopColor="#BACDA7"/></linearGradient>
   </defs>
   <rect width="780" height="530" fill="url(#countrySky)"/>
   <path d="M0 192 Q140 110 282 186 Q405 100 544 165 Q670 99 780 139V530H0Z" fill="#F0F0DD"/>
   <path d="M0 261 Q140 184 264 249 Q407 180 537 214 Q678 158 780 210V530H0Z" fill="#E1E8CC"/>
   <path d="M0 318 Q151 264 274 311 Q391 247 518 292 Q663 248 780 280V530H0Z" fill="url(#countryGround)"/>
   <path d="M0 404 Q114 335 249 381 Q389 330 503 395 Q650 341 780 383V530H0Z" fill="#C7D6B1"/>
   <path d="M0 474 Q164 416 324 465 Q490 408 646 449 Q724 421 780 435V530H0Z" fill="#B5C9A3"/>
   <path d="M510 -10 C600 59 525 93 533 149 S612 234 515 273 S391 342 491 391 S630 457 528 542" fill="none" stroke="#FAF8ED" strokeWidth="59" strokeLinecap="round"/>
   <path d="M510 -10 C600 59 525 93 533 149 S612 234 515 273 S391 342 491 391 S630 457 528 542" fill="none" stroke="#8173D8" strokeWidth="2.4" strokeDasharray="3 8" strokeLinecap="round"/>
   <g fill="#6A8D6C">
    <path d="M689 209L713 124L737 209Z M696 177L713 104L730 177Z"/><rect x="709" y="204" width="8" height="31" fill="#8F9270"/>
    <path d="M735 301L754 228L773 301Z M742 278L754 214L766 278Z"/><rect x="751" y="299" width="6" height="29" fill="#8F9270"/>
    <path d="M57 357L79 276L101 357Z M63 323L79 263L95 323Z"/><rect x="76" y="352" width="6" height="30" fill="#8F9270"/>
    <path d="M160 227L175 170L190 227Z M166 202L175 157L184 202Z"/><rect x="173" y="225" width="4" height="18" fill="#8F9270"/>
    <path d="M329 424L346 361L363 424Z M336 403L346 344L356 403Z"/><rect x="344" y="422" width="4" height="18" fill="#8F9270"/>
   </g>
   <g fill="#7B9B75"><ellipse cx="133" cy="298" rx="13" ry="38"/><rect x="131" y="297" width="4" height="29" fill="#8F9270"/><ellipse cx="653" cy="365" rx="12" ry="34"/><rect x="651" y="363" width="4" height="25" fill="#8F9270"/></g>
   <circle cx="532" cy="92" r="4" fill="#7569D2"/><circle cx="531" cy="197" r="4" fill="#7569D2"/><circle cx="532" cy="307" r="4" fill="#7569D2"/><circle cx="480" cy="403" r="4" fill="#7569D2"/>
  </svg>
  <div className="absolute left-[39%] top-[9%] flex items-center gap-2 text-[10px] font-medium text-[#34435B] sm:text-xs"><span>Public stocks</span><ChartNoAxesColumn size={16} aria-hidden="true"/></div>
  <div className="absolute left-[31%] top-[30%] flex items-center gap-2 text-[10px] font-medium text-[#34435B] sm:text-xs"><span>Real estate</span><Landmark size={16} aria-hidden="true"/></div>
  <div className="absolute left-[40%] top-[46%] flex items-center gap-2 text-[10px] font-medium text-[#34435B] sm:text-xs"><span>Funds</span><Layers3 size={16} aria-hidden="true"/></div>
  <div className="absolute left-[28%] top-[64%] flex items-center gap-2 text-[10px] font-medium text-[#34435B] sm:text-xs"><span>Private credit</span><span className="flex size-6 items-center justify-center rounded-full border border-[#BDB4EF] text-[#5549E8]"><Leaf size={13} aria-hidden="true"/></span></div>
  <div className="absolute bottom-[5%] left-[56%] flex items-center gap-3 text-lg font-semibold text-[#4132C9] sm:text-xl"><span className="flex size-11 items-center justify-center rounded-full bg-[#5944EC] text-white shadow-[0_3px_12px_rgba(89,68,236,.15)] sm:size-14"><Leaf size={25}/></span>Zenvest <Check size={17} aria-label="Selected"/></div>
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