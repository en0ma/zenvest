import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, ArrowUpRight, Wallet } from "lucide-react";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
import { ActivateDepositWallet, CopyDepositAddress } from "@/components/deposit-wallet-actions";
export const dynamic="force-dynamic";
export default async function WalletPage(){
 const user=await requireUser();
 const [portfolio, depositWallet]=await Promise.all([
  prisma.investorPortfolio.findUnique({where:{userId:user.id}}),
  prisma.investorDepositWallet.findUnique({where:{userId:user.id}}),
 ]);
 return <Shell><div className="mx-auto max-w-5xl">
  <header className="mb-12 border-b border-[#E3E8EE] pb-9"><p className="zen-eyebrow">Investor account</p><h1 className="mt-2 text-4xl sm:text-6xl font-semibold tracking-[-.065em]">Wallet</h1><p className="mt-3 text-sm text-[#425466]">Your USDC funding and withdrawal overview.</p></header>
  <section className="rounded-[24px] bg-[#F6F9FC] p-8"><p className="text-sm text-[#425466]">Unallocated capital</p><h2 className="zen-value mt-5 text-5xl sm:text-7xl">{formatUsdc(portfolio?.unallocatedUsdcMicros??0n)}</h2><p className="mt-3 text-sm text-[#425466]">Reported balance, not necessarily eligible for immediate withdrawal.</p></section>
  <section className="mt-8 rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold tracking-tight">Receive USDC</h2><span className="text-xs font-semibold text-[#635BFF]">Solana network</span></div>
   {depositWallet?.status === "ACTIVE" && depositWallet.address ? <div className="mt-5 space-y-4">
    <p className="text-sm text-[#425466]">Send USDC on Solana to your deposit address.</p>
    <p className="break-all rounded-xl bg-[#F6F9FC] p-4 font-mono text-sm">{depositWallet.address}</p>
    <CopyDepositAddress address={depositWallet.address}/>
   </div> : depositWallet ? <p className="mt-5 text-sm text-[#425466]">Wallet activation needs attention. Contact support before sending any funds.</p> : <div className="mt-5 space-y-5">
    <p className="text-sm text-[#425466]">Activate your wallet to receive a dedicated Solana USDC deposit address.</p>
    <ActivateDepositWallet/>
   </div>}
  </section>
  <div className="mt-12 grid gap-8 sm:grid-cols-2">
   <Link href="/deposits" className="group flex flex-col justify-between gap-7 rounded-2xl border border-[#E3E8EE] bg-white p-7 hover:border-[#B8C6B8]"><div><ArrowDownToLine className="text-[#635BFF]" size={23}/><h2 className="mt-5 text-xl font-semibold">Deposit USDC</h2><p className="mt-2 text-sm leading-6 text-[#425466]">View recorded deposits and funding availability.</p></div><span className="zen-link">View deposits <ArrowUpRight size={16} className="inline"/></span></Link>
   <Link href="/withdrawals" className="zen-panel group flex flex-col justify-between gap-7 p-6 transition-shadow hover:shadow-lg"><div><ArrowUpFromLine className="text-[#635BFF]" size={23}/><h2 className="mt-5 text-xl font-semibold">Withdraw USDC</h2><p className="mt-2 text-sm leading-6 text-[#425466]">Review withdrawal records and eligibility.</p></div><span className="zen-link">View withdrawals <ArrowUpRight size={16} className="inline"/></span></Link>
  </div>
 </div></Shell>;
}
