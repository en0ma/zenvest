import { ArrowUpFromLine, Clock3, LockKeyhole, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { PageIntro, BalanceTile, DetailPanel } from "@/components/investor-ui";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
export const dynamic="force-dynamic";
export default async function Withdrawals(){
 const user=await requireUser();
 const portfolio=await prisma.investorPortfolio.findUnique({where:{userId:user.id}});
 return <Shell><PageIntro eyebrow="Investor portal / Capital" title="Withdrawals" description="Track pending withdrawal records and review how withdrawal requests will be handled."/>
 <div className="grid gap-4 md:grid-cols-2"><BalanceTile label="Pending withdrawals" value={portfolio?.pendingWithdrawalsKobo??0n} icon={Clock3} detail="Recorded pending amount"/><BalanceTile label="Unallocated capital" value={portfolio?.unallocatedKobo??0n} icon={ArrowUpFromLine} detail="Reporting balance; not necessarily available to withdraw"/></div>
 <div className="grid gap-5 lg:grid-cols-2 mt-6"><DetailPanel icon={LockKeyhole} title="Withdrawal requests" description="Withdrawal requests are not open at this stage. This page will provide eligibility, available-to-withdraw balances, account verification and confirmation steps when withdrawals are enabled."/><DetailPanel icon={ShieldCheck} title="How withdrawals will work" description="Approved withdrawals will require available settled funds, custody reconciliation and authorization. Allocated capital and unsettled trading outcomes cannot be assumed withdrawable." link="/transactions" linkText="See transaction history"/></div></Shell>
}
