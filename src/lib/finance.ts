/** All amounts are minor units (kobo for NGN); never use floats for live monetary ledgers. */
export type TradeAllocation = Readonly<{ investorId: string; allocatedKobo: bigint; effectiveAt: number }>;
export type TradeSnapshot = Readonly<{ tradeId: string; cutoffAt: number; allocations: readonly TradeAllocation[] }>;
/** Largest remainder pro-rata distribution preserves the exact aggregate result, including losses. */
export function distributeTradePnl(snapshot: TradeSnapshot, netPnlKobo: bigint): Map<string, bigint> {
  const active = snapshot.allocations.filter(x => x.effectiveAt <= snapshot.cutoffAt && x.allocatedKobo > 0n);
  if (new Set(active.map(x => x.investorId)).size !== active.length) throw new Error("Duplicate investor allocation");
  const total = active.reduce((s, x) => s + x.allocatedKobo, 0n);
  if (total === 0n) {
    if (netPnlKobo !== 0n) throw new Error("Cannot distribute P&L without allocated funds");
    return new Map();
  }
  const negative = netPnlKobo < 0n;
  const magnitude = negative ? -netPnlKobo : netPnlKobo;
  const items = active.map(x => {
    const numerator = magnitude * x.allocatedKobo;
    return { id: x.investorId, base: numerator / total, remainder: numerator % total };
  });
  let leftover = magnitude - items.reduce((s, x) => s + x.base, 0n);
  items.sort((a, b) => a.remainder === b.remainder ? a.id.localeCompare(b.id) : a.remainder > b.remainder ? -1 : 1);
  for (const item of items) { if (leftover === 0n) break; item.base += 1n; leftover -= 1n; }
  return new Map(items.map(x => [x.id, negative ? -x.base : x.base]));
}
export function formatNgn(kobo: number) {
  return new Intl.NumberFormat("en-NG", {style:"currency", currency:"NGN", maximumFractionDigits:0}).format(kobo / 100);
}
