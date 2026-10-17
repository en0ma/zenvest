import Link from "next/link";
import { Signout } from "@/components/signout";
import { LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, ChartNoAxesCombined, Clock3, ShieldCheck, Wallet } from "lucide-react";
export function Shell({ admin = false, preview = false, children }: {admin?:boolean;preview?:boolean;children:React.ReactNode}) {
  const nav = admin ? [
    {text:"Overview",href:"/admin",icon:LayoutDashboard},
    {text:"Investor account",href:"/dashboard",icon:Wallet},
  ] : [
    {text:"Overview",href:"/dashboard",icon:LayoutDashboard},
    {text:"Deposits",href:"/dashboard#deposits",icon:ArrowDownToLine},
    {text:"Withdrawals",href:"/dashboard#withdrawals",icon:ArrowUpFromLine},
    {text:"Allocations",href:"/dashboard#allocations",icon:ChartNoAxesCombined},
    {text:"Activity",href:"/dashboard#activity",icon:Clock3},
 
  ];
  const items = preview ? nav.map(item => ({ ...item, href: item.href.replace("/dashboard", "/preview/investor").replace("/admin", "/preview/admin") })) : nav;
  return <div className="min-h-screen lg:flex">
    <aside className="bg-forest text-white lg:w-64 p-7 lg:min-h-screen">
      <Link href="/" className="text-3xl font-bold tracking-tight text-mint">zenvest<span className="text-white">.</span></Link>
      <p className="text-xs tracking-[.16em] text-white/50 uppercase mt-2">Investment Portal</p>
      <nav className="mt-12 flex flex-wrap lg:flex-col gap-2">{items.map(({href,text,icon:Icon})=>
        <Link key={text} href={href} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm hover:bg-white/10"><Icon size={17}/>{text}</Link>
      )}</nav>
      {!preview && <Signout/>}<div className="mt-12 rounded-xl bg-white/10 p-4 text-xs leading-5 text-white/75">Account reporting only. Trading, funding and withdrawals are not currently enabled.</div>
    </aside>
    <main className="flex-1 min-w-0 px-5 py-8 sm:px-10 lg:px-12 lg:py-10 max-w-[1500px] mx-auto">{children}</main>
  </div>;
}
