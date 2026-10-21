# Treasury balance buckets and planned platform flows

The `treasury_transactions` direction enum has seven values:
- **DEPOSIT**: verified investor sweep into master wallet.
- **ALLOCATE**: pooled investor funds sent from master to Kalshi; treasury transaction PROCESSING after a verified successful transfer submission, ALLOCATE balance credited after independently authenticated Kalshi funding confirmation.
- **DEALLOCATE**: return of investor capital from Kalshi to master; confirm using matched Blockradar receipt.
- **WITHDRAWAL**: investor payout from master; Blockradar-confirmed outcome controls settlement. The withdrawal record contains gross and fee, but the verified treasury transaction is the settlement fee source.
- **PLATFORM_K_BANK**: platform share of a **profitable, settled** strategy trade, retained inside Kalshi. Intended future trade settlement: calculate `platform_profit_share` in micro-USDC using `strategies.platform_profit_percentage` and verified positive `strategy_trades.profit`, create a unique PLATFORM_K_BANK treasury transaction and increment K_BANK exactly once. Losses and repeated events must not mint profit shares.
- **PLATFORM_M_BANK**: platform share transferred from Kalshi into master custody. Admin may request at most `K_BANK - SUM(pending/processing/review PLATFORM_M_BANK amounts)`; after verified funds arrive, decrement K_BANK and increment M_BANK exactly once. Do not subtract pending requests from K_BANK itself before settlement.
- **PLATFORM_PULL**: future admin-initiated movement of platform-held funds out of master custody.

The `treasuries` table is designed for exactly one balance row per `kind`: WITHDRAWAL_FEE, DEPOSIT_FEE, DEPOSIT, ALLOCATE, M_BANK, K_BANK (six kinds, notwithstanding the earlier 'five rows' description). `kind` is UNIQUE. Amounts are USDC micros, updated atomically with the respective settlement record.

Bucket meaning:
- DEPOSIT: investor unallocated funds held in master wallet.
- ALLOCATE: investor-allocated funds held in Kalshi.
- WITHDRAWAL_FEE / DEPOSIT_FEE: retained fees in master wallet (deposit fee presently zero).
- K_BANK: platform profits at Kalshi, not yet withdrawn.
- M_BANK: platform profits confirmed at master wallet.

**Integration status:** Platform profit settlement, PLATFROM_M_BANK submissions/confirmations, PLATFORM_PULL, allocation and deallocation settlement APIs are NOT implemented. The position workers still monitor only. The investor withdrawal payout cron is intentionally disabled until a new, race-safe treasury reservation and custody reconciliation path is implemented.

**Critical implementation conditions:** use authenticated origin/destination webhooks, provider IDs, unique transaction references, strict matching on asset, amount, wallet, and direction. All final balance and request status changes must be a single idempotent database transaction. No synthetic Kalshi events or providers.

**Capacity and ownership:** keep platform funds separate from investor funds. Do not treat platform shares as investor position P&L. The current schema has no authoritative per-investor strategy trade participation attribution and should not claim investor P&L settlement.
