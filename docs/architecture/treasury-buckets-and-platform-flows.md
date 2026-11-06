# Treasury balance buckets and planned platform flows

The `treasury_transactions` direction enum defines four investor flows and four active staff-bank transaction kinds:
- **DEPOSIT**: signed, verified investor sweep into master custody.
- **WITHDRAWAL**: verified investor payout from DEPOSIT to an external wallet.
- **ALLOCATE**: investor principal leaves master custody for Kalshi; final ALLOCATE balance awaits an independent destination receipt.
- **DEALLOCATE**: verified investor capital return from Kalshi to DEPOSIT (a transaction history kind, **not** a treasury balance bucket).
- **K_BANK_DEPOSIT**: platform earnings recognized in Kalshi after separately verified profitable trade settlement. The platform-profit treasury accrual is not yet integrated, so no automatic entry is created today.
- **K_BANK_WITHDRAWAL**: verified outbound platform-profit transfer from Kalshi to the master wallet.
- **M_BANK_DEPOSIT**: receipt of that same verified platform-profit transfer into master custody. The Kalshi withdrawal and master deposit ledger entries are created as an idempotent pair, with distinct references, in the same transaction as K_BANK debit and M_BANK credit.
- **M_BANK_WITHDRAWAL**: confirmed staff payout of platform-owned funds from master custody. The payout may draw on M_BANK, DEPOSIT_FEE, and WITHDRAWAL_FEE, never investor DEPOSIT.

`PLATFORM_PULL`, `PLATFORM_M_BANK`, and `PLATFORM_K_BANK` are legacy enum labels retained for compatibility, but active code must not write them. The new enum labels need an additive PostgreSQL enum migration; no existing balance-data conversion is required. A single Kalshi-to-master transfer has two equal and opposite custody-ledger entries, **not two balance credits**.

The `treasuries` table uses exactly one balance row per active `kind`: WITHDRAWAL_FEE, DEPOSIT_FEE, DEPOSIT, ALLOCATE, M_BANK, K_BANK (six active kinds). `kind` is UNIQUE. The legacy `DEALLOCATE` enum member is retained for database compatibility but has no active balance row; never create or credit one. The `DEALLOCATE` *transfer direction and strategy event kind* remain for audit history. Amounts are USDC micros and settle transactionally.

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
- DEPOSIT: investor unallocated funds held in the master wallet, including independently verified strategy returns.
- ALLOCATE: investor-allocated funds held in Kalshi. A verified return atomically debits ALLOCATE and credits DEPOSIT; allocation debits DEPOSIT after signed Blockradar outbound success and credits ALLOCATE only after independently authenticated Kalshi receipt and safe position application.
- WITHDRAWAL_FEE / DEPOSIT_FEE: retained fees in master wallet (deposit fee presently zero).
- K_BANK: platform profits at Kalshi, not yet withdrawn.
- M_BANK: platform profits confirmed at master wallet.

**Integration status (2026-10-23):** Allocation batching and outbound Blockradar submission exist, with signed Blockradar callbacks advancing allocations to CONFIRMING. Independent Kalshi receipt finalization and deallocation transport are not implemented. Platform profit accrual and real Kalshi transfer submission remain incomplete; verified staff master payouts are separately feature-gated. The investor withdrawal worker exists; cross-worker custody reservation and reconciliation remain release blockers.

**Critical implementation conditions:** use authenticated origin/destination webhooks, provider IDs, unique transaction references, strict matching on asset, amount, wallet, and direction. All final balance and request status changes must be a single idempotent database transaction. No synthetic Kalshi events or providers.

**Capacity and ownership:** keep platform funds separate from investor funds. Do not treat platform shares as investor position P&L. The current schema has no authoritative per-investor strategy trade participation attribution and should not claim investor P&L settlement.
