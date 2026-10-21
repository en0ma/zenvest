# Draft PR #39 — financial flow audit and test plan

Status: **not approved for merge or live custody**. A passing lint/typecheck/unit-test job is not enough to prove provider settlement or migration correctness.

## What is tested now
- Existing repository unit tests (validation, money parsing/formatting, etc.).
- New tests in `tests/treasury-accounting.test.ts`: exact withdrawal gross=net+fee, invalid fee cases, zero/negative trading P&L not accruing platform revenue, 0–100% share arithmetic in integer micro-USDC, K_BANK availability after pending platform transfers, negative balance guards.
- `withdrawalSplit` is called by the payout webhook; profit-share and K_BANK reservation helpers are **planning primitives only**, not active provider settlement implementations.

## High-priority gaps and required integration tests

1. **Database migration rehearsal:** apply `prisma migrate deploy` against a disposable copy with realistic users, bot trades, withdrawals, legacy foreign keys and deposits. Validate all table renames, drops, enum transitions, wallet FKs and history preservation. Confirm `users.unallocated` backfill. Explicitly archive dropped tables before running a destructive migration.
2. **Deposit provider replay and concurrency:** signed, matching `deposit.success` then `deposit.swept.success`; duplicate success in parallel; unrelated mint/wallet/network/amount; failed sweep and late success; verify exactly one credit each to `deposits`, `users.unallocated`, `treasury_transactions`, `treasuries.DEPOSIT`, and investor activity.
3. **Withdrawal fee accounting:** successful signed payout must debit user gross exactly once, reduce DEPOSIT bucket by gross and credit WITHDRAWAL_FEE bucket by treasury transaction fee; reject mismatched gross, treasury fee, address, asset, tx ID, signature, and repeated or out-of-order events. Test error/rollback if one bucket cannot be changed. Existing requests created before the new ledger must be migrated deliberately.
4. **Concurrent reservation:** multiple same-user withdrawal and position allocation requests must not exceed `users.unallocated`. Assert serializable conflict/retry behavior using real PostgreSQL concurrent transactions. At present no explicit shared `users` write lock is acquired before request insertion; verify PostgreSQL predicate-read protection under the exact isolation level or add one.
5. **Available funds and fees:** dashboard, Earn and Wallet must reconcile pending withdrawal/allocations with settled principal; no phantom funds from pending requests. Dashboard's realized P&L is recorded per position, **not a verified strategy-to-investor profit distribution**.
6. **Allocation/deallocation & Kalshi webhook:** fail closed until exact provider endpoints and authenticated receipt semantics are established. Test one pooled transfer linked to multiple requests, idempotent callback, amount/asset matching, partial failures, and no allocation credit before actual Kalshi receipt.
7. **Platform profit lifecycle:** derive platform percentage from strategy, settle strictly profitable strategy trades once per event, round exact micro-USDC amounts consistently, reserve pending PLATFORM_M_BANK requests without premature K_BANK balance subtraction, and update K_BANK/M_BANK only after authenticated Kalshi and master-wallet confirmation. This workflow is **not implemented**.
8. **Treasury bucket invariants:** six global unique kinds per schema. Verify asset/network consistency and enforce nonnegative amount where applicable. Deposits charge zero fee today; test later nonzero fees before activation.
9. **Payout cron:** currently intentionally returns 503 after authentication. Re-enable only with verified provider master-wallet balance, race-safe claim/reservation, submission ambiguity handling and webhook settlement. Test retry and process crash between provider submission and persistence.

## Important implementation observations
- `treasuries.kind` is globally unique, so this design holds exactly one row per kind, not a historical journal. `treasury_transactions` is the event-level audit trail.
- `profit` / `platform_profit_share` in `strategy_trades` are decimal columns, while `treasuries.amount` is BIGINT in micro-USDC. Specify and test unit conversion before implementing profit posting.
- `market_trade_id` is nullable for legacy trades; the strategy/event unique constraint does not prevent multiple rows whose ID is NULL. New events must require provider-verified non-null IDs before trading.
- No verified investor allocation proceeds or investor-specific P&L settlement currently exists. Do not equate strategy-wide trade P&L to user P&L.
- Provider integrations are not covered by the current unit tests and were not tested against production custody.

**Release gate:** CI green, PostgreSQL migration on test database, webhook replay/concurrency integration suite, trusted provider test environment verification, and explicit review of monetary invariants.
