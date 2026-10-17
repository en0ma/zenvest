import { requireAdmin } from "@/lib/access";
import { prisma } from "@/lib/db";
import { botFreshness, usdcFromMicros } from "@/lib/bot-telemetry";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function BotPage() {
 await requireAdmin();
 const bot = await prisma.botStatus.findFirst({orderBy:{updatedAt:"desc"},include:{trades:{orderBy:{openedAt:"desc"},take:25}}});
 return <Shell admin><div className="flex items-center justify-between gap-4"><h1 className="text-3xl font-semibold">Trading bot monitor</h1><span className="text-xs text-muted">Read-only telemetry</span></div>
 {!bot ? <section className="mt-8 rounded-xl bg-white p-6">No bot status received yet. Configure the external bot to publish telemetry to PostgreSQL.</section> :
 <><section className="mt-7 bg-white rounded-2xl p-6 border"><div className="flex justify-between"><strong>{bot.botId}</strong><span className={botFreshness(bot.asOf)==="CURRENT"?"text-green-700":"text-red-700"}>{botFreshness(bot.asOf)} · {bot.state}</span></div>
 <p className="mt-3 text-muted text-sm">As of {bot.asOf.toISOString()} · Event {bot.currentEventTicker??"None"} · Closes {bot.currentEventClosesAt?.toISOString()??"—"}</p>
 <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
 {[[ "YES contracts",String(bot.inventoryYesContracts)],["NO contracts",String(bot.inventoryNoContracts)],["Available funds (USDC)",usdcFromMicros(bot.availableFundsUsdcMicros)],["Reported releasable (USDC)",usdcFromMicros(bot.releasableFundsUsdcMicros)],["Realized P&L (USDC)",usdcFromMicros(bot.realizedPnlUsdcMicros)],["Unrealized P&L (USDC)",usdcFromMicros(bot.unrealizedPnlUsdcMicros)]].map(([k,v])=><div key={k} className="bg-canvas rounded-xl p-4"><p className="text-xs text-muted">{k}</p><strong className="text-xl">{v}</strong></div>)}
 </div><p className="mt-5 text-xs text-muted">Reported releasable funds are indicative only. Allocation releases and withdrawals require independent ledger and custody reconciliation.</p></section>
 <section className="mt-7 bg-white rounded-2xl border overflow-x-auto"><h2 className="text-xl font-semibold p-6">Recent bot trades</h2><table className="w-full text-sm text-left"><thead><tr className="bg-canvas"><th className="p-4">Event</th><th className="p-4">Side</th><th className="p-4">Contracts</th><th className="p-4">Realized P&L (USDC)</th><th className="p-4">Opened</th></tr></thead><tbody>{bot.trades.map(t=><tr className="border-t" key={t.id}><td className="p-4">{t.eventTicker}</td><td className="p-4">{t.side}</td><td className="p-4">{t.contracts}</td><td className="p-4">{t.realizedPnlUsdcMicros==null?"Unsettled":usdcFromMicros(t.realizedPnlUsdcMicros)}</td><td className="p-4">{t.openedAt.toISOString()}</td></tr>)}</tbody></table></section></>}
 </Shell>;
}
