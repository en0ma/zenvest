import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, ArrowUpRight, Wallet } from "lucide-react";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
export const dynamic="force-dynamic";
export default async function WalletPage(){
 const user=await requireUser();
 const portfolio=await prisma.investorPortfolio.findUnique({where:{userId:user.id}});
 return <Shell><div className="mx-auto max-w-5xl">
  <header className="mb-12 border-b border-[#DEE3ED] pb-9"><p className="zen-eyebrow">Investor account</p><h1 className="mt-2 text-4xl sm:text-6xl font-semibold tracking-[-.065em]">Wallet</h1><p className="mt-3 text-sm text-[#52637B]">Your USDC funding and withdrawal overview.</p></header>
  <section className="border-b border-[#DEE3ED] pb-12"><p className="text-sm text-[#52637B]">Unallocated capital</p><h2 className="zen-value mt-5 text-5xl sm:text-7xl">{formatUsdc(portfolio?.unallocatedUsdcMicros??0n)}</h2><p className="mt-3 text-sm text-[#52637B]">Reported balance, not necessarily eligible for immediate withdrawal.</p></section>
  <div className="mt-12 grid gap-8 sm:grid-cols-2">
   <Link href="/deposits" className="group flex flex-col justify-between gap-7 border-t-2 border-[#14253D] py-7 hover:text-[#5145A8]"><div><ArrowDownToLine className="text-[#5145A8]" size={23}/><h2 className="mt-5 text-xl font-semibold">Deposit USDC</h2><p className="mt-2 text-sm leading-6 text-[#52637B]">View recorded deposits and funding availability.</p></div><span className="zen-link">View deposits <ArrowUpRight size={16} className="inline"/></span></Link>
   <Link href="/withdrawals" className="zen-panel group flex flex-col justify-between gap-7 p-6 transition-shadow hover:shadow-lg"><div><ArrowUpFromLine className="text-[#5145A8]" size={23}/><h2 className="mt-5 text-xl font-semibold">Withdraw USDC</h2><p className="mt-2 text-sm leading-6 text-[#52637B]">Review withdrawal records and eligibility.</p></div><span className="zen-link">View withdrawals <ArrowUpRight size={16} className="inline"/></span></Link>
  </div>
 </div></Shell>;
}
