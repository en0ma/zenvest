import Link from "next/link";
import { AutoCloseDetails } from "@/components/auto-close-details";
import { Signout } from "@/components/signout";
import { LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, Bot, Menu, ReceiptText, Settings, Wallet } from "lucide-react";
export function Shell({ admin = false, preview = false, children }: {admin?:boolean;preview?:boolean;children:React.ReactNode}) {
  const nav = admin ? [
    {text:"Overview",href:"/admin",icon:LayoutDashboard},
    {text:"Investor account",href:"/dashboard",icon:Wallet},
  ] : [
    {text:"Dashboard",href:"/dashboard",icon:LayoutDashboard},
    {text:"Deposit",href:"/deposits",icon:ArrowDownToLine},
    {text:"Transactions",href:"/transactions",icon:ReceiptText},
    {text:"Withdrawal",href:"/withdrawals",icon:ArrowUpFromLine},
    {text:"Bot",href:"/bot",icon:Bot},
    {text:"Settings",href:"/settings",icon:Settings},
    ];
  const items = preview ? nav.map(item => ({ ...item, href: item.href.replace("/dashboard", "/preview/investor").replace("/admin", "/preview/admin") })) : nav;
  return <div className="min-h-screen lg:flex bg-[#faf8f3]">
    <header className="relative z-40 flex lg:hidden items-center justify-between h-[76px] border-b border-[#eee5dc] bg-white px-5 sm:px-7">
      <Link href="/" className="text-[27px] font-black tracking-tight text-[#292725]">zenvest<span className="text-[#91603f]">.</span></Link>
      <AutoCloseDetails className="relative"><summary aria-label="Open investor navigation" className="list-none cursor-pointer rounded-lg border border-[#f5ece0] p-2 text-[#292725]"><Menu size={22}/></summary>
        <nav aria-label="Investor navigation" className="absolute right-0 top-12 z-50 w-60 rounded-2xl border border-[#eadfce] bg-white p-4 shadow-xl flex flex-col gap-1 text-sm text-[#292725]">
          {items.map(({href,text,icon:Icon})=><Link key={text} href={href} className="flex items-center gap-3 rounded-lg px-3 py-3 font-semibold hover:bg-[#faf8f3]"><Icon size={17}/>{text}</Link>)}
          {!preview&&<div className="border-t border-[#eee5dc] mt-2 pt-2 px-3"><Signout mobile/></div>}
        </nav>
      </AutoCloseDetails>
    </header>
    <aside className="hidden lg:flex lg:flex-col bg-[#292725] text-white lg:w-64 p-7 lg:min-h-screen">
      <Link href="/" className="text-3xl font-bold tracking-tight text-[#d6a16f]">zenvest<span className="text-white">.</span></Link>
      <p className="text-xs tracking-[.16em] text-white/50 uppercase mt-2">Investment Portal</p>
      <nav aria-label="Investor sidebar" className="mt-12 flex flex-col gap-2">{items.map(({href,text,icon:Icon})=><Link key={text} href={href} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium hover:bg-[#d6a16f]/20 focus-visible:outline-2 focus-visible:outline-[#d6a16f]"><Icon size={17}/>{text}</Link>)}</nav>
      {!preview&&<Signout/>}
    </aside>
    <main className="flex-1 min-w-0 px-5 py-8 sm:px-10 lg:px-12 lg:py-10 max-w-[1500px] mx-auto">{children}</main>
  </div>;
}
