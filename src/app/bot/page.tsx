import { Activity, Radio, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { PageIntro, DetailPanel } from "@/components/investor-ui";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { botFreshness } from "@/lib/bot-telemetry";
export const dynamic="force-dynamic";
export default async function InvestorBot(){
 await requireUser();
 const bot=await prisma.botStatus.findFirst({orderBy:{updatedAt:"desc"},select:{state:true,asOf:true}});
 const fresh=bot?botFreshness(bot.asOf):"OFFLINE";
 return <Shell><PageIntro eyebrow="Investor portal / Strategy" title="Trading bot" description="A high-level view of the strategy's reported operational state. The trading system operates independently of Zenvest."/>
 <section className="border-t-2 border-[#14253D] py-9"><div className="flex items-center gap-2 text-[#5145A8] uppercase tracking-widest text-xs font-bold"><Radio size={16}/> Strategy telemetry</div><h2 className="mt-5 text-3xl font-semibold">{!bot?"No signal received":fresh==="CURRENT"?bot.state.replaceAll("_"," "):"Status unavailable"}</h2><p className="mt-3 text-[#52637B] leading-7">{!bot?"No status has been received from the external trading service.":fresh==="CURRENT"?"The state shown is the latest reported operating status, not a trading recommendation or investment return.":"The most recent bot report is stale, so the current operating state cannot be confirmed."}</p><p className="mt-5 text-xs text-[#52637B]">Last report: {bot?new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(bot.asOf)+" UTC":"Not available"}</p></section>
 <div className="mt-6 grid gap-5 lg:grid-cols-2"><DetailPanel icon={Activity} title="Your participation" description="Bot-wide balances and trades are not individual investor holdings. Personal trade allocations and reconciled outcomes will appear in your account history when attribution is available." link="/transactions" linkText="View your activity"/><DetailPanel icon={ShieldCheck} title="Independent reporting" description="Operational telemetry is informational only. A reported running state does not mean your funds were allocated or guarantee a trading result."/></div></Shell>
}
