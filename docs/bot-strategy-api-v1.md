# Bot Strategy API v1 — draft / do not deploy

The manager submits an application by email including their existing Zenvest **user handle**. A Super Admin verifies and assigns the `bot` role using that handle. The user can then create a strategy and generate a manager API credential in Bot Manager.

## Three-part strategy authentication

Each manager API credential is a public **API key ID** and a one-time-view **secret**. The same pair can access all strategies owned by that manager, but every **strategy-scoped** request must also include the exact public key of the selected strategy:

```http
X-Zenvest-API-Key: <manager-key-id>
X-Zenvest-API-Secret: <one-time-issued-manager-secret>
X-Zenvest-Strategy-Pubkey: zvs_<strategy-public-key>
Content-Type: application/json
```

Never send the secret in the query string. The server hashes the secret at rest and checks the current approved user role, account/2FA eligibility, key revocation, manager/strategy ownership, and strategy public-key match. All scoped calls are rate limited by manager key ID at **60 requests/minute across all of that key's strategies**. HTTP 429 includes Retry-After. Failed credential checks return 401/403; database limiter outages return 503. Managers can revoke keys globally and rotate them.

**Bootstrap exception:** `GET /api/v1/strategies` (listing all owned strategies) and `POST /api/v1/strategies` (creating a new strategy without a public key yet) require the API key ID and secret, but not a strategy public key. They return public keys for subsequent calls. A brand-new strategy has no public key to present before creation; requiring one for creation would be impossible.

## GET/POST /api/v1/strategies

GET lists all manager-owned strategies and their public keys. POST creates a private ONBOARDING strategy:

```json
{
  "market_type": "event",
  "venue": "kalshi",
  "asset": "KXBTC15M",
  "min_allocation": "10",
  "max_allocation": "5000"
}
```

The dashboard form also accepts `name` and `description`. Only event markets on Kalshi are supported. `asset` must identify a Kalshi `series_ticker` or `event_ticker` for read-only book validation; a friendly display alias (such as `BTC-15min`) needs a verified mapping before simulation. Allocation bounds use decimal USDC strings (six digits after the decimal at most); the transaction enforces positive min<=max.

There is **no strategy-wide side**; side is supplied on each trade. A new strategy is hidden from investors and cannot allocate or submit live trades.

## POST /api/v1/strategies/{strategy_id}/trade

Requires all three authentication headers and an `Idempotency-Key`. Body:

```json
{
  "order_type": "buy",
  "trade_size": 5,
  "event_id": "KXBTC15M-EXAMPLE",
  "side": "up"
}
```

`trade_size` currently means whole contracts. `yes`=`up` and `no`=`down`; aliases are normalized before idempotency comparisons.

**Only a strategy in TRADING may submit to the live trade-intake endpoint.** The endpoint currently returns 202, `RECEIVED_UNEXECUTED`, and `executed:false`: it is a durable request intent, **not** a live venue order or verified P&L. The manager's and Zenvest's configured profit percentages are frozen on the intent for prospective rate accounting, but they do not cause a fee/payout.

## Virtual sandbox endpoints

Requires all three authentication headers. A strategy in **ONBOARDING or MONITORING** may use:

- `POST /api/v1/strategies/{strategy_id}/sandbox/trade` — accepts the same trade payload and Idempotency-Key, but uses a **read-only** Kalshi market and current YES/NO order-book snapshot to simulate a fully liquidity-backed fill. Asks are inferred from opposite-side bids. No liquidity or excessive sweep slippage (>5 percentage points vs best level) fails closed. Virtual trading starts with **10,000 virtual USDC** per strategy (a provisional sandbox default) and keeps its own cash and inventory ledger.
- `POST /api/v1/strategies/{strategy_id}/sandbox/settle` — accepts `{"event_id":"<venue-market-ticker>"}`; **never** accepts a caller-provided winning side. Fetches the venue's independently resolved market result and only then pays out the virtual inventory. One settlement per strategy/market, fully idempotent.
- `GET /api/v1/strategies/{strategy_id}/sandbox/summary` — virtual cash, realized virtual P&L, open virtual positions, cost-basis equity and recent fills.

The sandbox fee is an **admin-configured bps estimate**, not a claim about the exact venue transaction charge. The venue ticker must belong to the configured strategy series/event. No live order, investor movement, treasury credit, fee payout, or verified-investor return is created. Simulation is explicitly labeled and does not prove realizable live returns. If the venue rejects read-only book requests or no validated result is available, sandbox operations reject rather than fabricate a fill or settlement.

## GET /api/v1/strategies/{strategy_id}/allocations

Read-only aggregates: investor positions and counts, committed/pending allocations and current state. No investor PII, transfers or withdrawal authority. Only TRADING accepts **new investor allocations**, and the separate investor allocation API checks capacity under a strategy lock.

## Admin admission and capacity

Admin configuration sets: sandbox estimated fee bps, minimum sandbox days/fills, maximum realized-cost drawdown, total strategy capacity, and the two current manager/platform net-profit percentages. Settings are serialized and audited; percentage changes create immutable history. Admin transitions to MONITORING and TRADING evaluate the sandbox admission record (including positive realized virtual P&L and an independently resolved virtual market). An explicit reasoned admission override is audited, but never bypasses real-money readiness.

TRADING also requires Kalshi and Blockradar wallet configuration, separate **provider-verified timestamps**, positive capacity/min/max limits, and zero open virtual positions. Verification timestamps cannot be set through the manager or admin settings API: an authenticated provider verification flow must populate them. Until that verification integration is present, live activation remains blocked.

## Still release-blocked

Live authenticated Kalshi order execution, independently verified custody binding and treasury funding, production-grade price marks/unrealized P&L, approved venue fee model, loss carryforward/revenue recognition, manager revenue accrual/payout reconciliation and full financial concurrency tests are not done. Existing platform-fee P&L posting must not be stacked on the new manager/platform profit split without explicit financial rules.

PR #90 is draft. **No live deployment, merge or production migration is authorized.**

### API limiter retention

The 60-request-per-minute fixed-window limiter remains fail-closed. A CRON_SECRET-protected, read-only-to-API-clients maintenance route `GET /api/internal/prune-bot-api-rate-limits` runs daily at 04:30 UTC and deletes **at most 1,000 windows older than 30 days per run**. It does not reset current windows, change API key permissions, or erase trade-intent records. Retention is operational housekeeping, not a financial reconciliation or a live trading enablement.

## Manager strategy accounting — non-payable provisional ledger

For each bot-owned strategy, the existing verified trade P&L worker freezes **manager and platform strategy percentages at the investor-exposure snapshot**, not when settlement eventually arrives. After independent venue settlement, the same serializable transaction that applies the existing investor net P&L and platform K_BANK fee writes **one immutable `bot_strategy_revenue_accounting` record per trade**. It captures verified gross P&L, the **already-posted legacy platform fee**, actual existing investor net P&L, frozen percentages and candidate manager/platform/investor scenario amounts. A database constraint enforces the candidate amounts conserve the gross and status stays `POLICY_PENDING_NO_PAYOUT`.

**The candidate shares are illustrative, not payable, accrued, realized income or new charges.** They do not move money, change investor equity, add a second K_BANK fee, issue statements, or post wallet transfers. Loss or zero gross settlement generates zero positive fee candidates. The manager overview shows recent entries only to that manager, clearly distinguished from verified live investor P&L. Sandbox and unexecuted intents cannot create these records.

Outstanding decisions before recognizing revenue: whether the two strategy shares **replace or include** the existing `platformProfitPercentage` fee; whether venue fee costs are already embedded in verified gross P&L; high-water mark and loss carryforward requirements; how realized profit is aggregated for a strategy; payout interval, withholding and custody/treasury source; and exact investor residual treatment. Do not enable payout until reconciliation is defined and tested.

## Approved manager accounting policy (2026-11-18)

**Supersedes the earlier provisional per-trade preview.** For external Bot Manager strategies, the pre-existing platform performance fee is **replaced**, not combined with the manager and platform strategy percentages. Net strategy profit is independently verified **gross realized event P&L before costs**, minus **verified venue fees, custody fees and operational fees**. Cost records contain separate amounts, provider/document reference IDs, the assertion that gross was measured before costs, and a verification timestamp; there is **no user/admin writer** for these records. Without trusted independent evidence of ALL components, accounting is PENDING_VERIFIED_COST_EVIDENCE and must not treat zero/missing costs as genuine zero expense.

UTC monthly cycle: monthly realized gains and losses offset **within** each reporting month. There is **no high-water mark and no loss carryforward into later months** (user left loss safeguards unselected). A month with zero or negative net profit produces zero positive manager/platform shares; all losses remain the investor residual. For positive monthly net, distribute the positive monthly profit pro rata among positive verified trade-level net contributions, after offsetting losses; apply each trade's frozen manager and platform percentages, then assign the remainder to investors. This respects any mid-month admin rate changes prospectively without reallocating earlier trade rates. Exact micro-USDC integer math conserves the monthly net amount.

`GET /api/bot-manager/accounting/monthly?strategy_id=<id>&month=YYYY-MM` is session-authenticated and owner-scoped. It returns OPEN_PERIOD, PENDING_TRADE_SETTLEMENT, NO_VERIFIED_TRADES, PENDING_VERIFIED_COST_EVIDENCE, RECONCILIATION_INCONSISTENT or CALCULATED_AWAITING_CUSTODY_RECONCILIATION. The final state is an **unpaid, nonbinding illustration**, even if a strategy has wallet identifiers or verification timestamps. All responses set `payable:false` and `manager_earnings_usdc_micros:"0"`; there is no payment mutation or liability creation. The legacy `bot_strategy_revenue_accounting` table remains for historical migration compatibility but its old per-trade scenario writer is bypassed and its contents are no longer shown as the approved policy.

The verified bot trade P&L worker is fail-closed: it does **not** post the legacy K_BANK performance fee or adjust investor equity until independently verified costs, custody reconciliation and the new ledger posting/reserve mechanism exist. Ordinary non-bot strategies retain the pre-existing P&L engine. The accounting endpoint cannot certify fee evidence or pay a manager. Provider cost attestation, authenticated cash custody reconciliation, reserve/liability posting, and monthly payout issuance remain explicit release blockers. **Do not merge/deploy/run production migrations without permission.**
