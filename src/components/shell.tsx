import Link from "next/link";
import { AutoCloseDetails } from "@/components/auto-close-details";
import { Signout } from "@/components/signout";
import { LayoutDashboard, Menu, ReceiptText, Settings, Wallet, ChartNoAxesCombined } from "lucide-react";
export function Shell({ admin = false, preview = false, children }: {admin?:boolean;preview?:boolean;children:React.ReactNode}) {
  const nav = admin ? [
    {text:"Overview",href:"/admin",icon:LayoutDashboard},
    {text:"Investor account",href:"/dashboard",icon:Wallet},
  ] : [
    {text:"Overview",href:"/dashboard",icon:LayoutDashboard},
    {text:"Wallet",href:"/wallet",icon:Wallet},
    {text:"Activity",href:"/transactions",icon:ReceiptText},
    {text:"Strategy",href:"/bot",icon:ChartNoAxesCombined},
    {text:"Settings",href:"/settings",icon:Settings},
  ];
  const items = preview ? nav.map(item => ({ ...item, href: item.href.replace("/dashboard", "/preview/investor").replace("/admin", "/preview/admin") })) : nav;
  return <div className="min-h-screen lg:flex bg-[#FAFAF8]">
    <header className="relative z-40 flex lg:hidden items-center justify-between h-[76px] border-b border-[#E4E8E2] bg-white px-5 sm:px-7">
      <Link href="/" className="text-[27px] font-black tracking-tight text-[#0A2540]">zenvest<span className="text-[#635BFF]">.</span></Link>
      <AutoCloseDetails className="relative"><summary aria-label="Open investor navigation" className="list-none cursor-pointer rounded-lg border border-[#E4E8E2] p-2 text-[#0A2540]"><Menu size={22}/></summary>
        <nav aria-label="Investor navigation" className="absolute right-0 top-12 z-50 w-60 rounded-2xl border border-[#E4E8E2] bg-white p-4 shadow-xl flex flex-col gap-1 text-sm text-[#0A2540]">
          {items.map(({href,text,icon:Icon})=><Link key={text} href={href} className="flex items-center gap-3 rounded-lg px-3 py-3 font-semibold hover:bg-[#F6F9FC]"><Icon size={17}/>{text}</Link>)}
          {!preview&&<div className="border-t border-[#E4E8E2] mt-2 pt-2 px-3"><Signout mobile/></div>}
        </nav>
      </AutoCloseDetails>
    </header>
    <aside className="hidden lg:flex lg:flex-col bg-[#FAFAF8] border-r border-[#E4E8E2] text-[#0A2540] lg:w-64 p-7 lg:min-h-screen">
      <Link href="/" className="text-3xl font-bold tracking-tight text-[#0A2540]">zenvest<span className="text-[#635BFF]">.</span></Link>
      <p className="text-xs tracking-[.16em] text-[#52637B] uppercase mt-2">Investment Portal</p>
      <nav aria-label="Investor sidebar" className="mt-12 flex flex-col gap-1">{items.map(({href,text,icon:Icon})=><Link key={text} href={href} className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium hover:bg-[#F6F9FC] hover:text-[#635BFF] focus-visible:outline-2 focus-visible:outline-[#635BFF]"><Icon size={17}/>{text}</Link>)}</nav>
      {!preview&&<Signout/>}
    </aside>
    <nav aria-label="Mobile investor navigation" className="fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-[#E4E8E2] bg-white/95 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]">{items.map(({href,text,icon:Icon})=><Link key={text} href={href} className="flex min-w-0 flex-col items-center gap-1 px-1 py-3 text-[10px] font-medium text-[#52637B] hover:text-[#635BFF] focus-visible:bg-[#EEF2FF]"><Icon size={20}/><span className="truncate">{text}</span></Link>)}</nav>
    <main className="flex-1 min-w-0 px-5 py-10 sm:px-10 lg:px-14 lg:py-14 max-w-[1500px] mx-auto pb-28 lg:pb-10">{children}</main>
  </div>;
}
