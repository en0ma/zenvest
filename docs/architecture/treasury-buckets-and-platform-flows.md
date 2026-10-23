# Treasury balance buckets and planned platform flows

The `treasury_transactions` direction enum has seven values:
- **DEPOSIT**: verified investor sweep into master wallet.
- **ALLOCATE**: pooled investor funds sent from master to Kalshi; treasury transaction PROCESSING after a verified successful transfer submission, ALLOCATE balance credited after independently authenticated Kalshi funding confirmation.
- **DEALLOCATE**: return of investor capital from Kalshi to master; confirm using matched Blockradar receipt.
- **WITHDRAWAL**: investor payout from master; Blockradar-confirmed outcome controls settlement. The withdrawal record contains gross and fee, but the verified treasury transaction is the settlement fee source.
- **PLATFORM_K_BANK**: platform share of a **profitable, settled** strategy trade, retained inside Kalshi. Intended future trade settlement: calculate `platform_profit_share` in micro-USDC using `strategies.platform_profit_percentage` and verified positive `strategy_trades.profit`, create a unique PLATFORM_K_BANK treasury transaction and increment K_BANK exactly once. Losses and repeated events must not mint profit shares.
- **PLATFORM_M_BANK**: platform share transferred from Kalshi into master custody. Admin may request at most `K_BANK - SUM(pending/processing/review PLATFORM_M_BANK amounts)`; after verified funds arrive, decrement K_BANK and increment M_BANK exactly once. Do not subtract pending requests from K_BANK itself before settlement.
- **PLATFORM_PULL**: future admin-initiated movement of platform-held funds out of master custody.

The `treasuries` table is designed for exactly one balance row per `kind`: WITHDRAWAL_FEE, DEPOSIT_FEE, DEPOSIT, DEALLOCATE, ALLOCATE, M_BANK, K_BANK (seven kinds). `kind` is UNIQUE. Amounts are USDC micros, updated atomically with the respective settlement record.

## Authoritative investor capital reservation rules (confirmed 2026-10-23)

The system calculates **available unallocated USDC** as:

`max(0, users.unallocated - SUM(active allocation amounts) - SUM(active withdrawal gross amounts))`

- **Position allocations reserve their full amount** while `PositionAllocation.status` is `PENDING`, `SUBMITTING`, `PROCESSING`, `CONFIRMING`, or `REVIEW`.
- **Investor withdrawals reserve their gross amount (net payout + fee)** while `InvestorWithdrawal.status` is `PENDING`, `SUBMITTING`, `PROCESSING`, or `REVIEW`. Withdrawals do **not** use `CONFIRMING`.
- `FAILED` and `CANCELLED` cease reserving funds. `COMPLETED` ceases reserving funds only as the corresponding verified settlement has atomically posted the actual financial debit; completed operations must never make the same principal spendable twice.
- Allocation `PROCESSING -> CONFIRMING` occurs only after a signed, field-matched Blockradar `withdraw.success`. It proves the outbound transfer, **not** Kalshi's receipt. `CONFIRMING -> COMPLETED` requires separately authenticated, matched Kalshi funding confirmation. Until then, do not debit the user's unallocated principal, increase the investor position, consume strategy capacity, or post the final ALLOCATE treasury movement.
- An ambiguous outbound response enters `REVIEW` with its reservation retained. A two-hour REVIEW timeout is policy, not evidence of provider cancellation: reconciliation of late confirmations is required.
- Calculate reservations consistently in request eligibility, strategy-capacity checks, wallet/Earn available balance presentation, and concurrent worker handling; use BigInt USDC micros, serializable transactions, conditional transitions and durable idempotency references.

**Implementation boundary (2026-10-23):** The `CONFIRMING` state and reservation accounting have been added; the independently authenticated Kalshi final-receipt handler is not yet implemented. Cross-worker master custody reservation/concurrency and late-confirmation reconciliation still require an audit and tests. Do not present outbound Blockradar success as fully settled capital.

Bucket meaning:
- DEPOSIT: investor unallocated funds held in master wallet.
- ALLOCATE: investor-allocated funds held in Kalshi.
- WITHDRAWAL_FEE / DEPOSIT_FEE: retained fees in master wallet (deposit fee presently zero).
- K_BANK: platform profits at Kalshi, not yet withdrawn.
- M_BANK: platform profits confirmed at master wallet.

**Integration status (2026-10-23):** Allocation batching and outbound Blockradar submission exist, with signed Blockradar callbacks advancing allocations to CONFIRMING. Independent Kalshi receipt finalization and deallocation transport are not implemented. Platform profit settlement, PLATFORM_M_BANK submission/confirmation, and PLATFORM_PULL are not implemented. The investor withdrawal worker exists; cross-worker custody reservation and reconciliation remain release blockers.

**Critical implementation conditions:** use authenticated origin/destination webhooks, provider IDs, unique transaction references, strict matching on asset, amount, wallet, and direction. All final balance and request status changes must be a single idempotent database transaction. No synthetic Kalshi events or providers.

**Capacity and ownership:** keep platform funds separate from investor funds. Do not treat platform shares as investor position P&L. The current schema has no authoritative per-investor strategy trade participation attribution and should not claim investor P&L settlement.
