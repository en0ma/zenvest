import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
import { ActivateDepositWallet, CopyDepositAddress } from "@/components/deposit-wallet-actions";
import { WalletWithdrawals } from "@/components/wallet-withdrawals";
export const dynamic="force-dynamic";
const PAGE_SIZE=10;
export default async function WalletPage({searchParams}:{searchParams:Promise<{depositsPage?:string;withdrawalsPage?:string}>}){
 const params=await searchParams;
 const rawPage=Number(params.depositsPage??"1");
 const requestedPage=Number.isSafeInteger(rawPage)&&rawPage>0?Math.min(rawPage,100000):1;
 const user=await requireUser();
 const account=await prisma.user.findUniqueOrThrow({where:{id:user.id},select:{unallocated:true}});
 const [depositWallet, depositCount, pendingWithdrawals, pendingAllocations]=await Promise.all([
  prisma.investorDepositWallet.findUnique({where:{userId:user.id}}),
  prisma.blockchainDeposit.count({where:{wallet:{userId:user.id}}}),
  prisma.withdrawal.aggregate({where:{userId:user.id,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},_sum:{grossUsdcMicros:true}}),
  prisma.positionAllocation.aggregate({where:{userId:user.id,kind:"ALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","REVIEW"]}},_sum:{amountUsdcMicros:true}}),
 ]);
 const pages=Math.max(1,Math.ceil(depositCount/PAGE_SIZE));
 const page=Math.min(requestedPage,pages);
 const history=await prisma.blockchainDeposit.findMany({where:{wallet:{userId:user.id}},orderBy:[{createdAt:"desc"},{id:"desc"}],skip:(page-1)*PAGE_SIZE,take:PAGE_SIZE});
 const qr = depositWallet?.status === "ACTIVE" && depositWallet.address ? await QRCode.toDataURL(depositWallet.address, {errorCorrectionLevel:"M",width:220,margin:2}) : null;
 return <Shell><div className="mx-auto max-w-5xl">
  <section className="mt-8 rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
   <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight">Deposit USDC</h2><p className="mt-2 text-sm text-[#425466]">Use your personal Solana deposit address to add funds.</p></div><span className="rounded-full bg-[#F0EEFF] px-3 py-1.5 text-xs font-semibold text-[#635BFF]">Solana · USDC</span></div>
   {depositWallet?.status === "ACTIVE" && depositWallet.address ? <div className="mt-5 space-y-4">
    <p className="text-sm text-[#425466]">Scan the QR code or copy your address to send USDC on Solana.</p>
    {qr && <Image src={qr} width={220} height={220} unoptimized alt="QR code containing your Solana deposit address" className="rounded-xl border border-[#E3E8EE] p-2"/>}
    <p className="break-all rounded-xl bg-[#F6F9FC] p-4 font-mono text-sm">{depositWallet.address}</p>
    <CopyDepositAddress address={depositWallet.address}/>
    <p className="rounded-xl bg-[#F6F9FC] px-4 py-3 text-sm leading-6 text-[#425466]">Only send USDC on Solana. Deposits appear in your balance after confirmation.</p>
   </div> : depositWallet ? <p className="mt-5 text-sm text-[#425466]">Wallet activation needs attention. Contact support before sending any funds.</p> : <div className="mt-5 space-y-5">
    <p className="text-sm text-[#425466]">Activate your wallet to receive a dedicated Solana USDC deposit address.</p>
    <ActivateDepositWallet/>
   </div>}
   <div className="mt-10 border-t border-[#E3E8EE] pt-7">
     <div><h3 className="text-lg font-semibold tracking-tight">Deposits</h3><p className="mt-2 text-sm text-[#64748B]">Track deposit confirmations and incoming USDC.</p></div>
     <div role="region" aria-label="Deposits table" tabIndex={0} className="mt-5 w-full max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-[#E7EDF4]">
         <table className="w-full min-w-[900px] border-collapse text-left">
           <thead className="bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wide text-[#64748B]"><tr>
             <th className="px-5 py-3">Received</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th>
             <th className="px-5 py-3">Transaction hash</th><th className="px-5 py-3">Credited</th>
           </tr></thead>
           <tbody className="divide-y divide-[#E9EEF5]">{history.map(item=><tr key={item.id} className="transition-colors hover:bg-[#FAFBFF]">
             <td className="whitespace-nowrap px-5 py-4 text-sm text-[#334155]">{item.createdAt.toLocaleString("en-US",{timeZone:"UTC",dateStyle:"medium",timeStyle:"short"})} UTC</td>
             <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-[#11263E]">+{formatUsdc(item.amountUsdcMicros)}</td>
             <td className="whitespace-nowrap px-5 py-4"><span className={item.status==="CONFIRMED"?"rounded-full bg-[#ECF7F1] px-3 py-1 text-xs font-semibold text-[#317054]":"rounded-full bg-[#F5F1E9] px-3 py-1 text-xs font-semibold text-[#8B6F43]"}>{item.status==="CONFIRMED"?"Confirmed":"Confirming"}</span></td>
             <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-[#64748B]" title={item.transactionHash}>{item.transactionHash}</td>
             <td className="whitespace-nowrap px-5 py-4 text-sm text-[#64748B]">{item.creditedAt?item.creditedAt.toLocaleString("en-US",{timeZone:"UTC",dateStyle:"medium",timeStyle:"short"})+" UTC":"—"}</td>
           </tr>)}{history.length===0&&<tr><td colSpan={5} className="px-5 py-8 text-sm text-[#64748B]">No deposits yet.</td></tr>}</tbody>
         </table>
       </div>
     <nav aria-label="Deposit history pages" className="mt-4 flex flex-wrap items-center justify-between gap-3">
       <span className="text-xs text-[#64748B]">{depositCount===0?"0 results":`Showing ${(page-1)*PAGE_SIZE+1}–${Math.min(page*PAGE_SIZE,depositCount)} of ${depositCount}`}</span>
       <div className="flex items-center gap-2 text-xs font-semibold">
         {page>1?<Link href={`/wallet?depositsPage=${page-1}`} className="rounded-lg border border-[#DEE5EE] px-3 py-2 hover:border-[#635BFF]">Previous</Link>:<span className="rounded-lg border border-[#DEE5EE] px-3 py-2 opacity-40">Previous</span>}
         <span className="text-[#64748B]">Page {page} of {pages}</span>
         {page<pages?<Link href={`/wallet?depositsPage=${page+1}`} className="rounded-lg border border-[#DEE5EE] px-3 py-2 hover:border-[#635BFF]">Next</Link>:<span className="rounded-lg border border-[#DEE5EE] px-3 py-2 opacity-40">Next</span>}
       </div>
     </nav>
   </div>
  </section>
  <WalletWithdrawals userId={user.id} unallocated={account.unallocated} pending={pendingWithdrawals._sum.grossUsdcMicros??0n} pendingAllocations={pendingAllocations._sum.amountUsdcMicros??0n} withdrawalsPage={params.withdrawalsPage} depositsPage={page}/>
 </div></Shell>;
}
