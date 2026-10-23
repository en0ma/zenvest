# Unified position and strategy events — implementation contract (2026-10-23)

Status (2026-10-23): **implementation underway on the draft branch**. Position-event schema consolidation, deprecated-column removal, and success-only withdrawal treasury creation have code/migrations; production deployment and Kalshi authenticated transport are not approved or complete. This document supersedes the older direct `position_allocations.treasury_id` batching model and older allocation-to-Kalshi completion claims. Do not treat this design text as deployed behavior.

## Tables and relationships

1. Rename `position_allocations` to `position_events`. Retain position ID, user ID, amount (BigInt USDC micros), status, and created/updated timestamps. Drop `request_key`, `treasury_id`, `provider_reference`, and `completed_at`. Add `strategy_id` (FK to strategies), `kind` (ALLOCATE / DEALLOCATE), and nullable `strategy_event_id` (FK to strategy_events). This becomes the shared source for allocation and deallocation requests. Populate strategy ID through each position's strategy and maintain it consistently.
2. Remove the standalone `position_deallocations` table only after moving its outstanding rows into `position_events` (or explicitly verifying disposable data may be discarded). Preserve the remaining deallocation ownership, amount-limit, and one-active-reduction invariants in the combined model.
3. Create `strategy_events` with ID, `kind` (ALLOCATE / DEALLOCATE), `amount` in USDC micros, `created_at`, `updated_at` (user supplied `updated_id`; interpreted as a likely timestamp naming typo pending confirmation), `strategy_id`, `status` (PROCESSING, CONFIRMING, COMPLETED), nullable `treasury_transaction_id`, `source_confirmed` and `destination_confirmed` default false. The event ID is the durable outbound provider correlation ID; unique batch membership is via `position_events.strategy_event_id`.
4. Preserve safe handling of asynchronous failures and ambiguous submissions: the user-specified strategy event statuses do not include REVIEW or FAILED. Until exceptions are explicitly mapped, retain existing protective reservation semantics and fail closed; never assume missing confirmations imply cancellation. The persistent `position_event_requests` table stores `request_key -> position_event_id` separately to preserve request idempotency when the original column is removed.

## Exact provider references and transaction fields

| Movement | Blockradar reference / ledger reference | Treasury record creation | origin_external_id | destination_external_id |
| --- | --- | --- | --- | --- |
| User deposit | Blockradar deposit transaction ID from signed `deposit.swept.success` | Only on authenticated, fully verified sweep, with status COMPLETE | Depositing address | Verified master wallet address |
| User withdrawal | `withdrawal:<withdrawal_id>` | Only on authenticated, matched `withdraw.success`, with status COMPLETE | Blockradar withdrawal transaction ID | Investor destination wallet address |
| Strategy funding withdrawal | `strategy_withdrawal:<strategy_event_id>` | Only on authenticated, matched Blockradar `withdraw.success`; status at creation reflects source-confirmed, destination-unconfirmed transfer, **not final Kalshi custody** | Blockradar withdrawal transaction ID | Verified Kalshi webhook transaction ID (only after authenticated receipt) |

The exact received webhook `reference` is stored in `treasury_transactions.reference` for withdrawals/strategy withdrawals. For deposits, use the received transaction ID without a prefix. Do not confuse the provider `data.id` with the chain transaction hash. Validate wallet, amount, mint, network, transaction identity and reference against the stored strategy event/request before accounting writes.

## Allocation worker and success transitions

1. A user's allocation request creates `position_events(kind=ALLOCATE, strategy_event_id=NULL)`; it does **not** create a treasury transaction.
2. Allocation cron chooses unbatched events with the same strategy ID and kind ALLOCATE. In a serializable transaction, atomically claim the rows, compute their exact sum, insert one `strategy_events(kind=ALLOCATE, status=PROCESSING, source_confirmed=false, destination_confirmed=false)`, and assign its ID to all claimed position events. No treasury transaction exists yet. Use the immutable `strategy_withdrawal:<strategy_event_id>` reference in the outbound Blockradar POST; do not resend uncertain submissions.
3. On authenticated, fully matched Blockradar `withdraw.success`, find the strategy event by reference, validate amount against its assigned position events and its expected Kalshi destination, then transactionally set source_confirmed=true, strategy event and linked position events to CONFIRMING, insert the ALLOCATE treasury transaction if absent (idempotent unique reference), and decrement the DEPOSIT treasury bucket exactly once. Keep investor principal reserved. Source confirmation does not mean Kalshi receipt.
4. On **independently authenticated Kalshi webhook** with a transaction uniquely matched to the strategy event, set destination_confirmed=true, record the Kalshi transaction ID in `treasury_transactions.destination_external_id`, increment ALLOCATE treasury once, complete the strategy event and linked position events, decrease each investor's unallocated funds and increase each investor position's principal, and account for strategy capacity, all in one serializable transaction. Only this independent destination confirmation permits COMPLETED.
5. A signed destination confirmation arriving before the Blockradar source confirmation should be saved/held for ordered reconciliation, not discarded or used to finalize prematurely. A duplicate or contradictory callback is idempotently ignored or surfaced for manual review.

## User deposits and withdrawals

- Deposit `deposit.success` records confirmation state only; full `deposit.swept.success` atomically creates COMPLETE treasury transfer and updates deposit, investor unallocated balance and DEPOSIT treasury bucket.
- The investor withdrawal request and worker retain a durable intent and the original full-gross reservation, and only an authenticated `withdraw.success` creates a COMPLETE `treasury_transactions` row in the same transaction as settlement. When settled, create the COMPLETE treasury row, debit user gross from unallocated, debit master bucket(s), post retained fee, mark withdrawal COMPLETED, all atomically.
- For ambiguous payout submissions, keep durable state outside the treasury transaction, with explicit REVIEW, no automatic re-send, and existing two-hour timeout and late success dead-letter behavior. Change worker and webhook code together before removing the existing `withdrawals.treasury_id` dependency.

## Current confirmed reservation rule

- Allocation events: PENDING, SUBMITTING, PROCESSING, CONFIRMING, REVIEW.
- User withdrawal records: PENDING, SUBMITTING, PROCESSING, REVIEW.
- Gross withdrawal reservation = payout net + approved fee. Available unallocated = max(0, users.unallocated − active allocation reservations − active gross withdrawal reservations).
- Terminal failures/cancellations release the hold, while successful settlement consumes funds exactly once.

## Migration and verification gates

- Update Prisma models, enums, FKs, application query paths, UI history, both worker routes, both webhook routes, withdrawal payout reference generation, tests, and documentation as a coordinated, CI-validated change. Existing deprecated tables/columns cannot be dropped in isolation.
- Verify all migration DDL on disposable PostgreSQL 16, including unique strategy-event/treasury links, FK constraints, amount conservation, duplicate webhook handling, concurrency, rollback, failure, late arrival, and reentrant cron processing.
- Block live financial operations until authenticated Kalshi receipt schema and correlation fields have been validated with provider documentation or sandbox fixtures. No invented endpoint, webhook event names, or fictional finality.
- No production DB migration, PR merge or deployment without explicit authorization.

## Updated implementation notes (2026-10-23)

- `position_events` no longer declares `request_key`, `treasury_id`, `provider_reference`, or `completed_at`. Existing request identifiers move to `position_event_requests` before the four columns are dropped by a nonproduction migration. The Earn history displays `updated_at` only for completed events.
- A regular user withdrawal creates no treasury transaction during PENDING, SUBMITTING, PROCESSING or REVIEW. The verified Blockradar `withdraw.success` handler creates one COMPLETE row, sets reference `withdrawal:<id>`, origin external ID to Blockradar transaction ID and destination external ID to the investor wallet address. FAILED/CANCELLED, REVIEW timeout, and archived late success create no treasury transaction.
- `withdrawals.treasury_id` is retained as an optional *post-settlement* link for compatibility. Its null value before settlement is intentional.
- The strategy-event destination settlement domain service exists but **no independently authenticated Kalshi webhook adapter** is yet wired; external receipts cannot be assumed valid.
- CI still needs to pass all migration, integration, typecheck, unit and build stages for the latest draft head before this can be described as verified.

## Durable webhook ingestion and asynchronous processing (2026-10-23)

Both provider sources use `webhook_queue`: `source` (BLOCKRADAR / KALSHI), `event_type`, source-scoped unique `idempotency_key`, the authenticated webhook `payload`, and `status` (PENDING / PROCESSED). Worker metadata (`lease_until`, `next_attempt_at`, `attempts`, `last_error`, timestamps) provides safe retries without adding statuses.

1. HTTP webhook ingress authenticates the genuine provider signature **before any write**, parses the event identity, and inserts the verified event into PostgreSQL. The queue payload retains the complete original raw bytes and signature as well as parsed body so the existing processing validation can be reused. Do not change treasuries or investor positions in the ingestion request.
2. Idempotency is enforced at the database boundary with unique (source, idempotency_key). For Blockradar, the key is SHA-256 of `event_type + NUL + provider transaction id`. This ensures `deposit.success` and `deposit.swept.success` remain distinct; an identical replay returns 200 without another queue entry, while the same key with conflicting raw content returns 409.
3. Return HTTP 200 **only after** durable insertion or confirmation of a matching existing queue entry. Invalid authentication is 401; invalid envelopes are 400; failed DB writes are 503 so the provider can retry. Authentication at ingestion is not a replacement for field validation inside the worker.
4. An authenticated `GET /api/internal/process-webhook-queue` (CRON_SECRET, once per minute) claims one eligible PENDING Blockradar event using a conditional lease, invokes the existing signed webhook processing logic, and marks PROCESSED only on handler success. Errors and non-2xx handler outcomes remain PENDING with exponential retry and a visible error field. Replayed processing must remain safe because monetary settlement handlers are idempotent.
5. KALSHI is a reserved source enum, **not an enabled webhook endpoint or processing adapter**. Kalshi ingestion must remain disabled until the provider's real authentication, receipt schema and transaction matching are independently verified. Queue entries from that source are not treated as settlement evidence.
6. A previous handler may deliberately acknowledge a semantically unrelated/invalid provider event with HTTP 200. The worker currently treats that as processed; add reconciliation/observability improvements before enabling live financial operations.

## User-request idempotency removal (2026-10-23)

The `withdrawals.idempotency_key` column and `position_event_requests` table have been removed on the draft branch. `webhook_queue` retains its source-scoped `idempotency_key`; durable settlement identity/reference and conditional status transitions remain necessary for protecting financial accounting against repeated processing. **Important difference:** webhook deduplication does not deduplicate the investor's original API requests. Retried POSTs for allocation or withdrawal may now create distinct requests if sufficient funds remain. Client requests must not be automatically retried without an explicit new user action; enforce balance and strategy constraints transactionally. Review that behavioral tradeoff before production release.
