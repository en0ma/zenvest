import {SecurityIdle} from "@/components/security-idle";
import Link from "next/link";
import { AutoCloseDetails } from "@/components/auto-close-details";
import { Signout } from "@/components/signout";
import { InvestorNavLink } from "@/components/investor-nav-link";
import { Menu } from "lucide-react";
export function Shell({ admin = false, preview = false, children }: {admin?:boolean;preview?:boolean;children:React.ReactNode}) {
  const nav = admin ? [
    {text:"Overview",href:"/admin"},
    {text:"Investor account",href:"/dashboard"},
  ] : [
    {text:"Overview",href:"/dashboard"},
    {text:"Wallet",href:"/wallet"},
    {text:"Investments",href:"/earn"},
    {text:"Settings",href:"/settings"},
  ];
  const items = preview ? nav.map(item => ({ ...item, href: item.href.replace("/dashboard", "/preview/investor").replace("/admin", "/preview/admin") })) : nav;
  return <div className="min-h-screen lg:flex bg-[#F5F6FC]">{!preview&&<SecurityIdle/>}
    <header className="relative z-40 flex lg:hidden items-center justify-between h-[76px] border-b border-[#38466B] bg-[#202B4A] px-5 sm:px-7">
      <Link href="/" className="text-[27px] font-black tracking-tight text-white">zenvest<span className="text-[#BFB9FF]">.</span></Link>
      <AutoCloseDetails className="relative"><summary aria-label="Open investor navigation" className="list-none cursor-pointer rounded-lg border border-[#DFE5EF] p-2 text-white"><Menu size={22}/></summary>
        <nav aria-label="Investor navigation" className="absolute right-0 top-12 z-50 w-60 rounded-2xl border border-[#DFE5EF] bg-white p-4 shadow-xl flex flex-col gap-1 text-sm text-[#243553]">
          {items.map(({href,text})=><InvestorNavLink key={text} href={href} text={text} variant="menu"/>)}
          {!preview&&<div className="border-t border-[#DFE5EF] mt-2 pt-2 px-3"><Signout mobile/></div>}
        </nav>
      </AutoCloseDetails>
    </header>
    <aside className="hidden lg:flex lg:flex-col bg-[#202B4A] border-r border-[#38466B] text-white lg:w-64 p-7 lg:min-h-screen">
      <Link href="/" className="text-3xl font-bold tracking-tight text-white">zenvest<span className="text-[#625DC1]">.</span></Link>
      <p className="text-xs tracking-[.16em] text-[#B9C7E4] uppercase mt-2">Your account</p>
      <nav aria-label="Investor sidebar" className="mt-12 flex flex-col gap-1">{items.map(({href,text})=><InvestorNavLink key={text} href={href} text={text} variant="sidebar"/>)}</nav>
      {!preview&&<Signout/>}
    </aside>
    <nav aria-label="Mobile investor navigation" className="fixed bottom-0 inset-x-0 z-40 grid grid-cols-4 border-t border-[#DFE5EF] bg-white/95 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]">{items.map(({href,text})=><InvestorNavLink key={text} href={href} text={text} variant="mobile"/>)}</nav>
    <main className="flex-1 min-w-0 px-5 py-10 sm:px-10 lg:px-14 lg:py-14 max-w-[1500px] mx-auto pb-28 lg:pb-10">{children}</main>
  </div>;
}
