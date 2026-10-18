import { Clock3 } from "lucide-react";
import { Shell } from "@/components/shell";
import { PageIntro } from "@/components/investor-ui";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc-money";
export const dynamic="force-dynamic";
export default async function Transactions(){
 const user=await requireUser();
 const portfolio=await prisma.investorPortfolio.findUnique({where:{userId:user.id}});
 const events=portfolio?await prisma.investorActivity.findMany({where:{portfolioId:portfolio.id},orderBy:[{occurredAt:"desc"},{createdAt:"desc"}],take:100}):[];
 return <Shell><PageIntro eyebrow="Investor portal / Records" title="Transactions" description="A chronological view of the verified account activity recorded for your investor profile."/>
 <section className="rounded-2xl border border-[#e7dbcd] bg-white overflow-hidden"><div className="flex justify-between flex-wrap items-center gap-3 px-6 py-5 border-b border-[#eee6dd]"><h2 className="font-semibold text-[#292725]">Account activity</h2><span className="text-xs text-[#897b6d]">{events.length} recent records</span></div>{events.length===0?<div className="py-14 px-6 text-center"><Clock3 className="mx-auto text-[#b77d52]" size={28}/><h3 className="mt-4 text-lg font-semibold">No transactions yet</h3><p className="mt-2 text-sm text-[#75695d]">Your confirmed account events will appear here as they are recorded.</p></div>:<div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm text-left"><thead className="bg-[#faf8f3] text-[#75695d]"><tr><th className="px-6 py-4 font-medium">Date</th><th className="px-6 py-4 font-medium">Type</th><th className="px-6 py-4 font-medium">Details</th><th className="px-6 py-4 font-medium text-right">Amount (USDC)</th></tr></thead><tbody>{events.map(event=><tr key={event.id} className="border-t border-[#f0ebe4]"><td className="px-6 py-4 whitespace-nowrap">{new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(event.occurredAt)}</td><td className="px-6 py-4 whitespace-nowrap font-medium">{event.type.replaceAll("_"," ").toLowerCase()}</td><td className="px-6 py-4 text-[#75695d]">{event.description}</td><td className="px-6 py-4 text-right font-semibold whitespace-nowrap">{formatUsdc(event.amountUsdcMicros)}</td></tr>)}</tbody></table></div>}</section></Shell>
}
