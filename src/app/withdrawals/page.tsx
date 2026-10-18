import Link from "next/link";
import { ArrowUpFromLine, Clock3, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { PageIntro, BalanceTile } from "@/components/investor-ui";
import { WithdrawalForm, CancelWithdrawal } from "@/components/withdrawal-actions";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
export const dynamic="force-dynamic";

export default async function Withdrawals() {
  const user=await requireUser();
  const [portfolio,records,deallocations]=await Promise.all([
    prisma.investorPortfolio.findUnique({where:{userId:user.id}}),
    prisma.investorWithdrawal.findMany({where:{userId:user.id},orderBy:{createdAt:"desc"},take:30}),
    prisma.withdrawalDeallocation.findMany({where:{userId:user.id},orderBy:{createdAt:"desc"},take:30,
      include:{withdrawal:{select:{status:true,destinationAddress:true}}}}),
  ]);
  const enabled=process.env.BLOCKRADAR_WITHDRAWALS_ENABLED==="true";
  const allocated=portfolio?.allocatedUsdcMicros??0n;
  const unallocated=portfolio?.unallocatedUsdcMicros??0n;
  const pending=portfolio?.pendingWithdrawalsUsdcMicros??0n;
  const available=allocated+unallocated>pending?allocated+unallocated-pending:0n;
  return <Shell><div className="mx-auto max-w-5xl">
    <PageIntro eyebrow="Investor portal / Capital" title="Withdrawals" description="Request Solana USDC payouts and track their status."/>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <BalanceTile label="Allocated capital" value={allocated} icon={ShieldCheck} detail="May require Kalshi deallocation"/>
      <BalanceTile label="Unallocated capital" value={unallocated} icon={ArrowUpFromLine} detail="Not currently allocated"/>
      <BalanceTile label="Pending withdrawals" value={portfolio?.pendingWithdrawalsUsdcMicros??0n} icon={Clock3} detail="Reserved for withdrawal requests"/>
      <BalanceTile label="Available to withdraw" value={available} icon={ArrowUpFromLine} detail="Allocated + unallocated − pending"/>
    </div>
    <section className="mt-6 rounded-2xl border border-[#E3E8EE] bg-white p-6">
      <div className="flex items-center gap-3"><ShieldCheck size={20} className="text-[#635BFF]"/><h2 className="text-xl font-semibold">Request a withdrawal</h2></div>
      {enabled?<WithdrawalForm balanceMicros={available.toString()}/>:<p className="mt-4 text-sm text-[#425466]">Withdrawal requests are not enabled yet.</p>}
    </section>
    <section className="mt-6 rounded-2xl border border-[#E3E8EE] bg-white p-6">
      <h2 className="text-xl font-semibold">Deallocation requests</h2>
      <p className="mt-2 text-sm text-[#425466]">Funds being returned from allocated capital. Completed deallocations increase unallocated capital independently of withdrawal payout status.</p>
      {deallocations.length===0?<p className="mt-4 text-sm text-[#425466]">No deallocation requests.</p>:
      <div className="mt-4 divide-y divide-[#E3E8EE]">
        {deallocations.map(item=><div key={item.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
          <div>
            <p className="font-semibold">{formatUsdc(item.amountUsdcMicros)} USDC deallocation</p>
            <p className="mt-1 text-xs text-[#425466]">Requested {item.createdAt.toLocaleString("en-US",{timeZone:"UTC",dateStyle:"medium",timeStyle:"short"})} UTC</p>
            <p className="mt-1 text-xs text-[#425466]">Related withdrawal: {item.withdrawal.status}</p>
            {item.completedAt&&<p className="mt-1 text-xs text-[#425466]">Returned {item.completedAt.toLocaleString("en-US",{timeZone:"UTC",dateStyle:"medium",timeStyle:"short"})} UTC</p>}
          </div>
          <span className="rounded-full bg-[#F6F9FC] px-3 py-1 text-xs font-semibold">{item.status}</span>
        </div>)}
      </div>}
    </section>
    <section className="mt-6 rounded-2xl border border-[#E3E8EE] bg-white p-6">
      <h2 className="text-xl font-semibold">Withdrawal history</h2>
      {records.length===0?<p className="mt-4 text-sm text-[#425466]">No withdrawals yet.</p>:
        <div className="mt-4 divide-y divide-[#E3E8EE]">
          {records.map(record=><div key={record.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
            <div className="min-w-0"><p className="font-semibold">{formatUsdc(record.amountUsdcMicros)} USDC payout</p><p className="mt-1 text-xs text-[#425466]">Fee: {formatUsdc(record.feeUsdcMicros)} USDC · Gross requested: {formatUsdc(record.grossUsdcMicros)} USDC</p>
              <p className="mt-1 break-all font-mono text-xs text-[#425466]">{record.destinationAddress}</p>
              <p className="mt-1 text-xs text-[#425466]">{record.createdAt.toLocaleString("en-US",{timeZone:"UTC",dateStyle:"medium",timeStyle:"short"})} UTC</p>
              {record.transactionHash&&<p className="mt-1 break-all font-mono text-xs text-[#425466]">Transaction: {record.transactionHash}</p>}
              {record.status==="PENDING"&&<CancelWithdrawal id={record.id}/>}
            </div>
            <span className="rounded-full bg-[#F6F9FC] px-3 py-1 text-xs font-semibold">{record.status}</span>
          </div>)}
        </div>}
    </section>
    <p className="mt-6 text-sm text-[#425466]">Withdrawals may include allocated USDC; that portion waits for Kalshi deallocation and transfer before payout. <Link href="/wallet" className="underline">Return to wallet</Link>.</p>
  </div></Shell>;
}
