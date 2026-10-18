import { ArrowDownToLine, BookOpen, Clock3, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { PageIntro, BalanceTile, DetailPanel } from "@/components/investor-ui";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
export const dynamic="force-dynamic";
export default async function Deposits(){
 const user=await requireUser();
 const portfolio=await prisma.investorPortfolio.findUnique({where:{userId:user.id}});
 return <Shell><PageIntro eyebrow="Investor portal / Funding" title="Deposits" description="Track USDC contributions and their confirmation status. Only USDC deposits will be supported."/>
 <div className="grid gap-4 md:grid-cols-2"><BalanceTile label="Recorded deposits" value={portfolio?.depositedUsdcMicros??0n} icon={ArrowDownToLine} detail="Account records only"/><BalanceTile label="Pending deposits" value={portfolio?.pendingDepositsUsdcMicros??0n} icon={Clock3} detail="Amounts awaiting confirmation"/></div>
 <div className="grid gap-5 lg:grid-cols-2 mt-6"><DetailPanel icon={ShieldCheck} title="Deposit instructions" description="USDC-only deposits are planned. Deposits are not yet enabled; the supported network and verified wallet instructions will appear here when funding is available. Do not transfer assets without verifying the network and destination."/><DetailPanel icon={BookOpen} title="What happens after funding?" description="USDC funding will be recorded only after blockchain confirmation and reconciliation. Once it is confirmed, eligible capital can be considered for allocations under the applicable terms." link="/transactions" linkText="View account transactions"/></div></Shell>
}
