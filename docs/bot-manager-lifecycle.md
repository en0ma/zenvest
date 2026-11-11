# Bot Manager: roles, strategy lifecycle and pooled shutdown

Draft implementation. **Not production-ready**. Admin-only bot role assignment requires an active, verified user with verified 2FA; existing login/JWT session controls are retained.

Each approved manager may create multiple bots and strategies. Bot creation also creates a private strategy in ONBOARDING, with no ability to accept investor allocations or automatically fund Kalshi. An approved manager has a shared manager-scoped API key usable across every strategy they own. Keys are cryptographically random, hashed at rest, displayed only on issuance, and revocable across all manager strategies. Each strategy API operation enforces owner isolation. A bot key does not authorize custody, investor balance updates, or verification of trade outcomes. Trade/event API surface and independent Kalshi trade verification are future integration work.

Only Super Admin can transition:
- ONBOARDING -> MONITORING (visible to investors, but no allocations; observational events only)
- MONITORING -> TRADING (requires configured Kalshi and Blockradar wallet identities; investor allocations allowed)
- ONBOARDING/MONITORING/TRADING -> SHUTTING_DOWN (blocks future allocations; new trade ingestion must also reject)
- SHUTTING_DOWN -> SHUTDOWN **only via coordinator** after verified capital and position closure.

The coordinator waits for outstanding trades and P&L, uses one pooled StrategyEvent/DEALLOCATE event containing investor-specific PositionAllocation records, and never retries an ambiguous Kalshi withdrawal submission. Current adapter is intentionally a mock; its acceptance does **not** confirm funds moved. Position deallocation and FINAL SHUTDOWN require authenticated source and master custody evidence and fully reconciled investor position balances.

Important limitations requiring further work before enabling live manager strategies:
1. Fully connected authenticated bot trade intake and prevention of newly accepted events after shutdown.
2. Verified Kalshi destination receipts, authenticated Kalshi return transport and correlated master receipt settlement for pooled shutdown.
3. End-to-end PostgreSQL concurrency/authorization tests and full CI.
4. Automatic closure of every position following verified return and no pending financial events.
5. Operational handling of strategies with earlier completed deallocations, and reconciliation/monitoring on long-running shutdown.

Bot role revocation requires **all** owned strategies in SHUTDOWN and revokes all active manager keys in the same transaction. A single strategy shutdown does not revoke credentials needed to operate the manager's remaining strategies. Neither admins nor managers can force an unverified transfer to be treated as complete. No production migration/merge without explicit approval.

A strategy has a unique `shutdownEventId` to prevent a second pooled withdrawal. At the P&L-safe boundary, the coordinator debits remaining invested position equity and creates exactly one matched pooled StrategyEvent plus one internal deallocation event per investor position. That debit is a reservation for a pending external return, not an investor credit; confirmed master-wallet custody and authenticated Kalshi evidence are still mandatory before final deallocation. Existing uncompleted deallocation work blocks pooling rather than being silently included twice.

## Investor visibility and allocations

Public MONITORING and TRADING strategies appear in discovery and have investor-readable detail pages. MONITORING is explicitly labeled and does not show an allocation form. ONBOARDING, SHUTTING_DOWN and SHUTDOWN are not available in investor discovery. Only TRADING with active/public flags accepts new investor allocations; the server transaction re-checks TRADING after locking the strategy so a monitoring strategy cannot be funded by direct API calls or concurrent transitions.

## Strategy API contract

`POST /api/v1/strategies` creates an ONBOARDING strategy with `market_type: event`, `venue: kalshi`, an `asset` tag/slug and `min_allocation`/`max_allocation` USDC bounds. Strategy configuration does **not** include a side. Each event trade has its own side; yes/up are equivalent and no/down are equivalent. Keys are manager-scoped and rate-limited per key across all owned strategies. See `docs/bot-strategy-api-v1.md` for the complete contract.
