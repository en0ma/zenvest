import { Shell } from "@/components/shell";
import { requireAdmin } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
import {WithdrawalReviewResolve} from "@/components/withdrawal-review-resolve";
import {reviewAlertCutoff} from "@/lib/withdrawal-review-timeout";


export const dynamic="force-dynamic";

export default async function AdminWithdrawals() {
  await requireAdmin();
  const withdrawals=await prisma.withdrawal.findMany({
    orderBy:{createdAt:"desc"},take:100,
    include:{user:{select:{id:true,email:true}}},
  });
  const eligibleBefore=reviewAlertCutoff(new Date());
  return <Shell><div className="mx-auto max-w-5xl">
    <h1 className="text-3xl font-semibold">Withdrawal monitoring</h1>
    <p className="mt-3 text-sm text-[#425466]">Automated FIFO payouts are processed by the scheduled worker. REVIEW payouts require reconciliation before further action.</p>
    <section className="mt-6 divide-y divide-[#E3E8EE] rounded-2xl border border-[#E3E8EE] bg-white px-6">
      {withdrawals.length===0?<p className="py-6 text-sm">No withdrawal requests.</p>:
      withdrawals.map(w=><div key={w.id} className="flex flex-wrap items-start justify-between gap-5 py-6">
        <div className="max-w-xl space-y-2">
          <p className="font-semibold">Payout {formatUsdc(w.amountUsdcMicros)} USDC — {w.status}</p><p className="text-sm">Fee retained: {formatUsdc(w.feeUsdcMicros)} USDC · Gross requested: {formatUsdc(w.grossUsdcMicros)} USDC</p>
          <p className="text-sm">User: {w.user.email} ({w.userId})</p>
          <p className="break-all font-mono text-xs">Destination: {w.destinationAddress}</p>
          <p className="text-xs text-[#425466]">Withdrawal: {w.id}</p>
          {w.providerTransactionId&&<p className="text-xs text-[#425466]">Provider transaction: {w.providerTransactionId}</p>}
          {w.status==="REVIEW"&&<p className="text-xs text-[#425466]">Reference: withdrawal:{w.id} · {w.updatedAt<=eligibleBefore?"Eligible for staff reconciliation":"Resolution unlocks two hours after the last status update"}</p>}
        </div>
        {w.status==="REVIEW"&&w.updatedAt<=eligibleBefore&&<WithdrawalReviewResolve id={w.id}/>}
      </div>)}
    </section>
  </div></Shell>;
}
