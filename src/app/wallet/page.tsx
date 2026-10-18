import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { ArrowUpFromLine, ArrowUpRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
import { ActivateDepositWallet, CopyDepositAddress } from "@/components/deposit-wallet-actions";
export const dynamic="force-dynamic";
export default async function WalletPage(){
 const user=await requireUser();
 const [portfolio, depositWallet, history]=await Promise.all([
  prisma.investorPortfolio.findUnique({where:{userId:user.id}}),
  prisma.investorDepositWallet.findUnique({where:{userId:user.id}}),
  prisma.blockchainDeposit.findMany({where:{wallet:{userId:user.id}},orderBy:{createdAt:"desc"},take:25}),
 ]);
 const qr = depositWallet?.status === "ACTIVE" && depositWallet.address ? await QRCode.toDataURL(depositWallet.address, {errorCorrectionLevel:"M",width:220,margin:2}) : null;
 return <Shell><div className="mx-auto max-w-5xl">
  <header className="mb-12 border-b border-[#E3E8EE] pb-9"><p className="zen-eyebrow">Investor account</p><h1 className="mt-2 text-4xl sm:text-6xl font-semibold tracking-[-.065em]">Wallet</h1><p className="mt-3 text-sm text-[#425466]">Your USDC funding and withdrawal overview.</p></header>
  <section className="rounded-[24px] bg-[#F6F9FC] p-8"><p className="text-sm text-[#425466]">Unallocated capital</p><h2 className="zen-value mt-5 text-5xl sm:text-7xl">{formatUsdc(portfolio?.unallocatedUsdcMicros??0n)}</h2><p className="mt-3 text-sm text-[#425466]">Reported balance, not necessarily eligible for immediate withdrawal.</p></section>
  <section className="mt-8 rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold tracking-tight">Receive USDC</h2><span className="text-xs font-semibold text-[#635BFF]">Solana network</span></div>
   {depositWallet?.status === "ACTIVE" && depositWallet.address ? <div className="mt-5 space-y-4">
    <p className="text-sm text-[#425466]">Send USDC on Solana to your deposit address.</p>
    {qr && <Image src={qr} width={220} height={220} unoptimized alt="QR code containing your Solana deposit address" className="rounded-xl border border-[#E3E8EE] p-2"/>}
    <p className="break-all rounded-xl bg-[#F6F9FC] p-4 font-mono text-sm">{depositWallet.address}</p>
    <CopyDepositAddress address={depositWallet.address}/>
   </div> : depositWallet ? <p className="mt-5 text-sm text-[#425466]">Wallet activation needs attention. Contact support before sending any funds.</p> : <div className="mt-5 space-y-5">
    <p className="text-sm text-[#425466]">Activate your wallet to receive a dedicated Solana USDC deposit address.</p>
    <ActivateDepositWallet/>
   </div>}
   <div className="mt-10 border-t border-[#E3E8EE] pt-7">
   <h3 className="text-lg font-semibold tracking-tight">Recent deposits</h3>
   {history.length === 0 ? <p className="mt-4 text-sm text-[#425466]">No confirmed USDC deposits yet.</p> : <div className="mt-5 divide-y divide-[#E3E8EE]">
    {history.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
     <div><p className="font-semibold">USDC deposit</p><p className="mt-1 text-xs text-[#425466]">{item.creditedAt ? new Date(item.creditedAt).toLocaleString("en-US",{timeZone:"UTC",dateStyle:"medium",timeStyle:"short"})+" UTC" : "Awaiting confirmation"}</p><p className="mt-1 max-w-[240px] truncate font-mono text-xs text-[#425466]" title={item.transactionHash}>{item.transactionHash}</p></div>
     <div className="text-right"><p className="font-semibold text-[#0A2540]">+{formatUsdc(item.amountUsdcMicros)}</p><p className="mt-1 text-xs text-[#425466]">{item.creditedAt ? "Confirmed" : "Processing"}</p></div>
    </div>)}
   </div>}
   </div>
  </section>
  <div className="mt-8">
   <Link href="/withdrawals" className="flex items-center justify-between gap-4 rounded-2xl border border-[#E3E8EE] bg-white px-6 py-5 transition-colors hover:border-[#B9C7DB]">
    <span className="flex items-center gap-3"><ArrowUpFromLine className="text-[#635BFF]" size={20}/><span><span className="block text-base font-semibold">Withdrawals</span><span className="mt-1 block text-sm text-[#425466]">View withdrawal status and availability</span></span></span><ArrowUpRight size={18} className="shrink-0 text-[#635BFF]"/>
   </Link>
  </div>
 </div></Shell>;
}
