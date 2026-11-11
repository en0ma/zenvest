# Bot Strategy API v1 — draft

Base: `/api/v1/strategies`. Authenticate with a manager-level API key, shared across all strategies owned by that approved `bot` user:

```http
Authorization: Bearer zvb_<issued-secret>
Content-Type: application/json
```

All API operations verify the user's current `bot` role; strategy-specific endpoints also verify ownership, even if the manager has many strategies. A manager key cannot access another owner's strategies or control investor balances, payouts or custody.

## GET /api/v1/strategies

Lists all strategies owned by the manager, including ID, market type, venue, event tag/asset, configured minimum and maximum allocations (micro-USDC strings), current lifecycle state and whether new investor allocations are open.

## POST /api/v1/strategies

Creates a new strategy and associated bot in `ONBOARDING`, or configures an existing **unconfigured** onboarding bot when the optional `strategy_id` field is supplied.

```json
{
  "market_type": "event",
  "venue": "kalshi",
  "asset": "BTC-15min",
  "min_allocation": "10",
  "max_allocation": "5000"
}
```

Only `event` market type and `kalshi` venue work in v1. `asset` is the event tag/slug. There is **no strategy-side field**. `min_allocation` and `max_allocation` are positive USDC decimal strings, up to six fractional digits, with minimum less than or equal to maximum and values within signed 64-bit USDC micro-unit capacity. They persist as `minAllocationUsdcMicros` and `maxAllocationUsdcMicros`; the existing investor allocation API enforces these limits. Creating/configuring does not grant public visibility or allocation: admin approvals remain mandatory.

## POST /api/v1/strategies/{strategy_id}/trade

```http
Idempotency-Key: trade-20261111-0001
```
```json
{
  "order_type": "buy",
  "trade_size": 5,
  "event_id": "BTC-15min-123",
  "side": "up"
}
```

`order_type` is `buy` or `sell`; `trade_size` is a positive integer count of **contracts**, at most 1,000,000; `event_id` is the chosen event market ID. Each trade supplies its own side. `yes` and `up` are synonyms (canonical `yes`); `no` and `down` are synonyms (canonical `no`). Synonymous sides deduplicate correctly under the same idempotency key. Requests for different strategies are isolated by strategy ID and manager ownership.

**Safety boundary:** the endpoint returns HTTP `202`, status `RECEIVED_UNEXECUTED`, `executed:false`. This is a recorded, idempotent intent only. It does not place an order at Kalshi, independently validate the event, count as verified trade history, change investor balances or settle returns. Strategy states ONBOARDING/SHUTTING_DOWN/SHUTDOWN reject new trade intents; MONITORING/TRADING permit intake only.

## GET /api/v1/strategies/{strategy_id}/allocations

Read-only manager-owned aggregate: invested USDC micro-units, number of open positions, investor count and pending investor allocations. The bot key cannot create or withdraw allocations.

## Rate limits

The per-credential atomic PostgreSQL fixed-window budget is **60 requests per minute across all of that key's strategies and v1 endpoints**. Excess returns `429` and `Retry-After`; database limiter failure returns `503`. Keys can be issued/revoked/rotated via Bot Manager and are displayed only once. Multiple active manager keys may exist during rotation, but each is usable on all owned strategies.

## Release blockers

Independent Kalshi order execution and verification, event identity/side/market validation and risk enforcement, verified custody and reconciliation for pooled shutdown, sufficient integration/concurrency tests, passing CI and scheduled rate-limit-row cleanup. **No live execution, production migration, merge or deployment without approval.**
