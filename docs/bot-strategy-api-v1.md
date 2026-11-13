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
