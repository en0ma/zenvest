# Zenvest position trade P&L and invested equity

## Current implementation (draft PR #39)

- `positions.allocated_usdc_micros` is current investor equity held inside the strategy, including previously settled net P&L. `positions.realized_pnl_usdc_micros` has been removed. Nonzero historical values of that legacy column block the migration rather than being erased.
- `users.unallocated` represents master-wallet investor capital; available for both withdrawals and allocations is `max(0, unallocated - active allocation reservations - active withdrawal reservations)`. Portfolio balance is `unallocated + sum(position allocated)`. Reservation funds remain part of unallocated until custody confirmation.
- `positions.status` is `OPEN | CLOSING | CLOSED`; an ordinary deallocation never closes. CLOSED is read-only history. The only supported close transition is an explicit close API. `last_pnl_updated` flags complete final P&L for a CLOSING position.
- `strategy_trades.status` is `AWAITING_ALLOCATION | TRADING | SETTLED | ENDED (legacy) | ERROR` with `is_pnl_calculated`. Bot creates `AWAITING_ALLOCATION`; it may trade only once P&L cron snapshots eligible OPEN positions and sets `TRADING`; the bot supplies the independently finalized event outcome, sets `SETTLED`, and fills `settled_at` / `realized_pnl_usdc_micros`. A settled trade with `is_pnl_calculated=false` is eligible for processing.
- `position_trade_pnl` snapshots each participating OPEN position's allocated capital before the bot may trade. Snapshot is immutable, uniquely identified by `(strategy_trade_id, position_id)`. Gross, fee and net realized micros are populated once per settled event.
- `/api/internal/process-position-trade-pnl` runs every minute. It processes settled uncalculated trades ordered by event end time and deterministic tie-breakers, using signed integer micro-USDC, stable largest-remainder allocation, an event-snapshotted profit-share rate, and a serializable transaction. It increments/decrements affected `positions.allocated_usdc_micros`, posts each investor event, sets `is_pnl_calculated=true`, and when possible snapshots the next waiting event. No event with no eligible invested equity is released for trading.
- New verified allocation custody completion debits `users.unallocated` and increments `positions.allocated_usdc_micros` atomically. Verified future deallocation completion must reverse these movements atomically. P&L does **not** credit `users.unallocated`: gains remain reinvested.
- The shared strategy-row `FOR UPDATE` lock is used by the P&L worker, verified funding settlement, and explicit close request. Any future authenticated Kalshi deallocation settlement **must** acquire that same lock before updating `positions.allocated_usdc_micros`, and use guarded increment/decrement. Status claims are not sufficient protection from competing balance changes.
- A CLOSING position is excluded from next trade exposure. Once all previously snapshotted event P&L is settled, `last_pnl_updated` becomes true and the closing deallocation coordinator creates a final full-balance DEALLOCATE request. That coordinator is **monitor-only for transfer submission** until authenticated Kalshi-to-master return is integrated. It does not credit unallocated or prematurely close nonzero positions.
- User dashboard includes capital overview, settled event analytics, cumulative net P&L visualization and per-event historical table; authenticated CSV report is available from `/api/earn/reports/trade-pnl.csv`. A true historical portfolio valuation chart requires a verified valuation series; invested cash flows must not be represented as investment gains.

## Settlement safeguards and pending provider work

1. Do not treat `SETTLED` alone as independent proof of Kalshi cash custody. The bot/provider integration must authenticate and verify a final event result before setting the status and amount. The cron **does not** fetch or authenticate Kalshi settlement events.
2. The current deallocation transfer worker has no authenticated Kalshi return rail. Automatic closure amounts can be queued but no funds are credited until a verified source and destination custody receipt is processed. Closing remains in progress until that integration.
3. Platform share is computed at event settlement but the future treasury/revenue reconciliation and pull-of-fees from Kalshi are separate concerns; never assume a platform fee was actually transferred to the master wallet just because a percentage was computed.
4. Do not backfill or fabricate earlier event-level history for historic `ENDED` trades. Historical aggregate P&L must be reconciled before applying the removal migration.
5. New provider corrections to already posted events require explicit reversed adjustments rather than mutation of settled attribution rows. Do not reapply the same event twice.
6. Settlement of partial deallocation and P&L of already-exposed trades must be coordinated to avoid funding shortfalls. All cash movements are subject to verified custody.

## Operational

Changes committed to the draft feature branch. Do not merge, deploy production, migrate production DB or enable real-money Kalshi trades without explicit operational approval and verification. The worker may be scheduled every minute but is not a provider authentication boundary.
