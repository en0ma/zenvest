import { ArrowDownToLine, BookOpen, Clock3, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { PageIntro, BalanceTile, DetailPanel } from "@/components/investor-ui";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
export const dynamic="force-dynamic";
export default async function Deposits(){
 const user=await requireUser();
 const portfolio=await prisma.investorPortfolio.findUnique({where:{userId:user.id}});
 return <Shell><PageIntro eyebrow="Investor portal / Funding" title="Deposits" description="See recorded contributions and follow the progress of funds associated with your account."/>
 <div className="grid gap-4 md:grid-cols-2"><BalanceTile label="Recorded deposits" value={portfolio?.depositedKobo??0n} icon={ArrowDownToLine} detail="Account records only"/><BalanceTile label="Pending deposits" value={portfolio?.pendingDepositsKobo??0n} icon={Clock3} detail="Amounts awaiting confirmation"/></div>
 <div className="grid gap-5 lg:grid-cols-2 mt-6"><DetailPanel icon={ShieldCheck} title="Deposit instructions" description="Online deposits are not available yet. Verified funding instructions and payment details will be displayed here when account funding is enabled. Never send money to an account shared through an unsolicited message."/><DetailPanel icon={BookOpen} title="What happens after funding?" description="Funding will be recorded only after settlement and reconciliation. Once it is confirmed, eligible capital can be considered for allocations under the applicable terms." link="/transactions" linkText="View account transactions"/></div></Shell>
}
