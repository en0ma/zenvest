# Per-trade (market event) P&L attribution — proposed design

**Status:** Design only; no P&L posting or Kalshi settlement integration implemented.
**Terminology:** A *trade event* is a `strategy_trades` row (Kalshi market/trade event). This is NOT a `strategy_events` row, which batches capital allocations or deallocations.

## Existing authoritative models

- `strategy_trades` currently carries `realized_pnl_usdc_micros`, `profit` and `platform_profit_share`, plus market identifiers, contract costs, market start/end and `settled_at`.
- `positions` has investor `principal_usdc_micros` and cumulative `realized_pnl_usdc_micros`.
- `strategies.platform_profit_percentage` configures profit participation.
- Completed funding and deallocation must establish ownership before eligible exposure changes.

## Proposed new model: position_trade_pnl

Exactly one row per (`strategy_trade_id`, `position_id`). It is created as an immutable exposure snapshot when the strategy commits capital to a market event, and enriched exactly once on authenticated/verified outcome settlement.

| Column | Type | Meaning |
|---|---|---|
| id | text PK | Record ID |
| strategy_trade_id | text FK strategy_trades | Trade / market event |
| position_id | text FK positions | Investor economic ownership |
| user_id | text FK users | Owner at snapshot; never infer from later changes |
| strategy_id | varchar(64) FK strategies | Strategy scope for checks/reporting |
| eligible_capital_usdc_micros | bigint >= 0 | Frozen capital basis at exposure cutoff |
| allocation_weight_numerator | bigint >= 0 | Numerator of investor's exact share (usually same as eligible capital) |
| allocation_weight_denominator | bigint > 0 | Sum of eligible capital across the snapshot |
| gross_pnl_usdc_micros | bigint signed | This position's share of market-event P&L before platform share |
| platform_fee_usdc_micros | bigint >= 0 | Fee assigned from positive event profit only |
| net_pnl_usdc_micros | bigint signed | Gross P&L minus platform share |
| status | enum SNAPSHOTTED / SETTLED | Accounting state |
| created_at | timestamp | Snapshot creation |
| settled_at | nullable timestamp | Immutable finalization |

Unique constraint `(strategy_trade_id, position_id)`; indexes on `(user_id, created_at)`, `(strategy_id, strategy_trade_id)`.

**Separate from the user's allocation/deallocation request table**: `position_events` describes capital movements; `position_trade_pnl` describes economic market results.

## Proposed strategy_trades additions

- `eligible_capital_usdc_micros` (bigint): frozen total positive investor capital eligible for this event.
- `gross_pnl_usdc_micros` (signed bigint): provider-verified realized event P&L, after any specified market transaction costs.
- `platform_fee_usdc_micros` (nonnegative bigint): platform's event-level share.
- `investor_net_pnl_usdc_micros` (signed bigint): gross minus platform share.
- `applied_platform_profit_percentage` (decimal): snapshotted profit percentage; later strategy setting edits cannot reprice old trades.
- `pnl_status` enum OPEN / SNAPSHOTTED / SETTLED (or reuse trade lifecycle with an explicit posting marker).
- `settlement_external_id` unique nullable, plus verified settled timestamp/evidence link for authenticated Kalshi reconciliation. Exact external receipt schema TBD.

Existing ambiguous decimal `profit` and `platform_profit_share` should NOT be assumed to represent micro-USDC. Deprecate only after reconciling their existing meaning and migrating historical rows.

## Exposure snapshot

1. At the trading event's *effective exposure cutoff* (before placing the order), atomically capture every eligible ACTIVE position for that strategy. Only already COMPLETED funding is eligible. Uncompleted ALLOCATE or DEALLOCATE transfers do not silently change historical ownership.
2. Freeze each position's capital basis and the strategy's applied fee rate. Capital moves after this point affect **future** trade events only.
3. If a deallocation overlaps an open trade, enforce a trading policy: either lock its eligible capital until exposure closes, or explicitly record the fraction still exposed. A simple balance read at settlement time is **not** valid.
4. If the event has no eligible capital, do not allocate it to investors. Flag for operational reconciliation.

**Open design choice:** For v1, use frozen settled principal as the proportional weight (not an unverified position balance). If profits are reinvested/compounded, the weight must instead be frozen *eligible equity* accounting for retained realized P&L and withdrawals, which requires a separate position equity ledger. Decide before production.

## Accounting and exact arithmetic

All money is signed integer micro-USDC, with no floats for postings. For a verified event gross P&L `G`:

- `platformFee = floor(max(G,0) * snapshottedFeePercentage / 100)`.
- `investorNet = G - platformFee`. Negative P&L is borne by investors; no platform performance fee on a loss.
- Distribute `G`, `platformFee`, and/or `investorNet` deterministically by frozen weights. Use integer quotient-and-remainder with a stable tie-breaker (e.g., ascending position ID) so *sum of child postings exactly equals each event total*, including negative G.
- For each position: `net = gross - fee`. After verifying complete sums, update `positions.realized_pnl_usdc_micros += net` and insert an `investor_activity` record with a deterministic unique reference `trade-pnl:<strategy_trade_id>:<position_id>`.
- The entire event posting (children, `strategy_trades` settlement, position aggregates, activity, and any *verified* fee / treasury movements) is one serializable transaction. Guard with conditional `OPEN/SNAPSHOTTED -> SETTLED` and database uniqueness: a duplicate result cannot post twice.
- Separate **economic P&L recognition** from **physical funds settlement**: a Kalshi-reported win is not proof USDC is back in the master wallet. Investor balances, withdrawability and `treasuries` must follow verified custody movements and the chosen payout/reinvestment policy.

### Illustrative allocation

Two frozen positions: A = 600 USDC, B = 400 USDC. Gross market profit = +100 USDC, platform share = 20%.

| Position | Share | Gross P&L | Platform share | Net investor P&L |
|---|---:|---:|---:|---:|
| A | 60% | +60 | 12 | +48 |
| B | 40% | +40 | 8 | +32 |
| **Total** | **100%** | **+100** | **20** | **+80** |

If gross event result is -50 USDC, fee = 0; A = -30 and B = -20, assuming the same frozen weights.

## Invariants / tests

- Every `position_trade_pnl` snapshot belongs to same strategy as parent trade and investor position; reject mismatched strategy IDs.
- Unique (trade, position) and unique provider settlement identity.
- Child eligible-capital sum equals snapshotted strategy eligible capital.
- Child gross sum == verified event gross; child fees == event fee; child net == event investor net; for each row gross - fee == net.
- All settled rows immutable; replay of verified result makes no additional aggregate or activity changes.
- Test concurrent trade settlement, concurrent funding/deallocation, missing receipts, late corrections, negative P&L, zero profit, rounding remainders, zero-capital event and position already CLOSED at settlement.
- Corrections after settlement should use explicit reversal/adjustment records rather than editing history.

## UI/reporting

- Strategy event performance: trade/market name, date, total realized P&L, platform share, net investor P&L and settlement status.
- Position: principal, cumulative realized net P&L, derived equity where supported, and an event-by-event chronological attribution table (gross, fee, net).
- Never label an unrealized trade return as settled or withdrawable.

## Gating decisions before implementation

1. Are profits retained/compounded in position equity, distributed to unallocated balance, or held at Kalshi until deallocation?
2. What exact cutoff determines investor participation when positions change near order execution?
3. Are market fees already included in the Kalshi result, and is the platform percentage taken from **positive net** realized market P&L?
4. What authenticated Kalshi evidence proves final trade P&L, and how are corrections/voided markets handled?

No production migrations, provider integrations, or trading behavior should be changed solely on this document.
