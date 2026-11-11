# Bot Strategy API v1 — draft contract

**Draft integration; not yet an executable trading API.** Base path: `/api/v1/strategies`. Use the unique API key generated in Bot Manager:

```http
Authorization: Bearer zvb_<issued-secret>
Content-Type: application/json
```

The key is bound to exactly one bot and its **already-created** strategy. Managers create a bot via their approved Bot Manager account; `POST /api/v1/strategies` configures that bot's ONBOARDING strategy once. It cannot create another strategy or bypass administrator approval.

## Endpoints

### GET /api/v1/strategies

Returns one authorized strategy as a `strategies` array, including `id`, `status`, `market_type`, `venue`, `asset`, `side`, `is_public` and `accepting_allocations`.

### POST /api/v1/strategies

```json
{
  "market_type": "event",
  "venue": "kalshi",
  "side": "yes",
  "asset": "BTC-15min"
}
```

Current v1 supported `market_type`: `event` only (mapped to the legacy database enum `PREDICTION`). Venue: `kalshi` only. Event side: `yes`, `no`, `up`, `down` (case-sensitive lowercase). `asset` denotes the configured event slug/tag, not a token address. Only works while ONBOARDING and before initial configuration. Returns `201` on success or `409` if already configured, locked or promoted. This is **configuration**, not market-creation, venue approval, or verified history.

### POST /api/v1/strategies/{strategy_id}/trade

```http
Idempotency-Key: trade-20261111-0001
```
```json
{
  "order_type": "buy",
  "trade_size": 5,
  "event_id": "BTC-15min-123",
  "side": "yes"
}
```

Order type: `buy` or `sell`. Trade size: positive integer in **contracts**, currently max 1,000,000, not dollars. `event_id` is required. Side must match the strategy's approved event side. Requires configured MONITORING or TRADING strategy. Under the strategy's row lock, submissions are rejected after SHUTTING_DOWN. An `Idempotency-Key` is mandatory and unique per strategy; repeating the same payload returns the same intent, conflicting payload returns `409`.

**Important:** Returns HTTP `202` with `status: "RECEIVED_UNEXECUTED"` and `executed: false`. It only records a requested intent; it does NOT place orders, reach Kalshi, generate trade-history evidence, change positions, or settle P&L. Actual trading requires an independently authenticated Kalshi execution adapter, risk enforcement and reconciliation. A recorded intent is not proof of successful strategy performance.

### GET /api/v1/strategies/{strategy_id}/allocations

Read-only. Returns `total_allocated_usdc_micros`, `open_position_count`, `investor_count`, `pending_allocation_usdc_micros`, `accepts_new_allocations` and current status. Money values are decimal strings of USDC micro-units (six decimal places). No investor identifiers or personal financial records. Bot credentials never authorize allocations, withdrawals or investor balance adjustments.

## Rate limits

Each unique bot API key has an independent atomic PostgreSQL fixed-window allowance of **60 requests per 60-second UTC-aligned window**, shared across instances and all v1 endpoints. Exceeding the limit returns HTTP `429`, with `Retry-After`, `X-RateLimit-Limit` and `X-RateLimit-Reset` headers. Unavailable limiter fails closed with HTTP `503`. Rotate/revoke keys from Bot Manager. The keys are hashed in storage and never redisplayed after creation. Operational retention/cleanup of expired rate-limit rows is required.

## Lifecycle

- ONBOARDING: API strategy configuration, no trade intake, hidden from investors.
- MONITORING: visible to investors, accepts **unexecuted trade intents** but no investor allocation.
- TRADING: visible and allocatable; trade intents **still do not execute** in this draft.
- SHUTTING_DOWN / SHUTDOWN: no trade intake or allocation; shutdown must use verified pooled return before finalization.

Prerequisites for live launch: authenticated Kalshi order transport and order/settlement receipts, independent market/event validation, monitoring vs real performance separation, per-trade exposure bounds, end-to-end database concurrency tests, and complete passing CI. **Do not merge/deploy or run production migrations without explicit approval.**
