/** Demo accounting utility; amounts are integer minor units (kobo), not floating point. */
export type TradeAllocation = Readonly<{ investorId: string; allocatedKobo: bigint; effectiveAt: number }>;
export type TradeSnapshot = Readonly<{ tradeId: string; cutoffAt: number; allocations: readonly TradeAllocation[] }>;

/** Exact, deterministic pro-rata P&L. Only allocations effective by cutoff participate. */
export function distributeTradePnl(snapshot: TradeSnapshot, netPnlKobo: bigint): Map<string, bigint> {
  if (!snapshot.tradeId.trim()) throw new Error("Trade ID is required");
  if (!Number.isSafeInteger(snapshot.cutoffAt) || snapshot.cutoffAt < 0) throw new Error("Invalid trade cutoff");
  if (typeof netPnlKobo !== "bigint") throw new Error("P&L must be bigint");
  const seen = new Set<string>();
  for (const allocation of snapshot.allocations) {
    if (!allocation.investorId.trim()) throw new Error("Investor ID is required");
    if (seen.has(allocation.investorId)) throw new Error("Duplicate investor allocation");
    seen.add(allocation.investorId);
    if (typeof allocation.allocatedKobo !== "bigint" || allocation.allocatedKobo < 0n) throw new Error("Invalid allocated capital");
    if (!Number.isSafeInteger(allocation.effectiveAt) || allocation.effectiveAt < 0) throw new Error("Invalid allocation effective time");
  }
  const active = snapshot.allocations.filter(x => x.effectiveAt <= snapshot.cutoffAt && x.allocatedKobo > 0n);
  const total = active.reduce((sum, x) => sum + x.allocatedKobo, 0n);
  if (total === 0n) {
    if (netPnlKobo !== 0n) throw new Error("Cannot distribute nonzero P&L without eligible allocated capital");
    return new Map();
  }
  const negative = netPnlKobo < 0n;
  const magnitude = negative ? -netPnlKobo : netPnlKobo;
  const items = active.map(x => {
    const numerator = magnitude * x.allocatedKobo;
    return { id: x.investorId, amount: numerator / total, remainder: numerator % total };
  });
  let leftover = magnitude - items.reduce((sum, x) => sum + x.amount, 0n);
  items.sort((a, b) => a.remainder === b.remainder ? a.id.localeCompare(b.id) : a.remainder > b.remainder ? -1 : 1);
  for (const item of items) {
    if (leftover === 0n) break;
    item.amount++;
    leftover--;
  }
  return new Map(items.map(x => [x.id, negative ? -x.amount : x.amount]));
}

export function formatNgn(kobo: number) {
  if (!Number.isSafeInteger(kobo)) throw new Error("Amount must be an integer number of kobo");
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);
}
