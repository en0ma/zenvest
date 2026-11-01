# Zenvest referral rewards — implementation design

**Status:** Proposed design; documentation only. **Date:** 2026-10-25.  
**Scope:** Direct-investor referral attribution, fee-linked commissions, capped rewards, and payouts via the reserved `@zenvest` platform handle.

## 1. Product decision

A Zenvest user who brings another investor earns a defined percentage **only of the platform fees actually charged to that specific referred investor** on settled position/trade P&L events. This is **not** a share of Zenvest's aggregate platform revenue, not a share of investor capital, and not an additional fee to the investor.

Each personally referred investor creates an independent commission stream with a **per-referred-user lifetime reward cap**. No multi-level commissions. The proposed values **20% of eligible fees** and **100 USDC cap per referred investor** are illustrative configuration defaults requiring commercial and compliance approval, not live terms.

The official, permanently reserved `@zenvest` platform identity sends USDC referral credits to the referrer through the existing internal, atomic handle-to-handle transfer accounting. Referral rewards appear in Wallet as **Referral reward — Received from @zenvest**, with a link to the originating commission. Do not count rewards as strategy performance or investment P&L.

### Example

A settled `position_trade_pnl` row for investor `@investor` records `platform_fee_usdc_micros = 10_000_000` (10 USDC). If `@referrer` directly referred that investor, the agreed commission is 20% and their remaining lifetime cap is at least 2 USDC:

- Investor pays the **same 10 USDC platform fee** and receives the same recorded net P&L as without referrals.
- `@referrer` earns **2 USDC**, transferred from `@zenvest`.
- Zenvest economically retains **8 USDC** of this fee before other costs.
- The commission is attributable to exactly that investor and exactly that settled `position_trade_pnl` row.

If the referrer has already earned 78 USDC for this investor and the next eligible fee is 150 USDC, a 20% raw commission would be 30 USDC, but the payout is **22 USDC**, after which this investor's referral stream is capped.

## 2. Existing system and source of truth

The current Prisma schema already defines:

- `StrategyTrade` in `strategy_trades`, including event settlement state.
- `PositionTradePnl` mapped to `position_trade_pnl`, uniquely identified by `(strategyTradeId, positionId)`, with `userId`, `status` (`SNAPSHOTTED` / `SETTLED`), `settledAt`, `grossPnlUsdcMicros`, `platformFeeUsdcMicros`, and `netPnlUsdcMicros`.
- `User` mapped to `users`, with a unique `handle` (maximum eight characters) and integer micro-USDC `unallocated` balance.
- `Send` mapped to `sends`, with sender/recipient IDs and handles, amount, status, and a unique `idempotencyKey`.

**Authoritative referral basis:** `PositionTradePnl.platformFeeUsdcMicros` from a finalized `SETTLED` record. Do **not** derive commission from `StrategyTrade.realizedPnlUsdcMicros`, investment allocation, gross P&L, arbitrary wallet transfers, or a user's overall fees.

Current schema has **no referral attribution or commission ledger** and does not yet identify a protected platform/system user. The tables and fields below are planned additions, not implemented features.

## 3. Referral attribution

### Enrollment and referral link

- Give each eligible referrer a unique, non-guessable referral token/code and a copyable link (for example, `/r/{token}`; route is a proposal).
- On first eligible registration, validate the token and bind `referredUserId` to exactly one `referrerUserId`. Use a unique constraint on the referred user. Attribution should be immutable after qualification except for auditable administrative remediation.
- Reject self-referrals, `@zenvest` as a referred customer/referrer, circular referrals, duplicate accounts and abuse. Do not allow client-supplied user IDs to determine attribution.
- Decide before launch: whether pre-existing accounts qualify, attribution expiry, one-referrer precedence, code rotation behavior, blocked regions, qualification conditions, and cases needing identity/fraud checks.
- No retroactive commissions for trades settled before the referral's eligibility effective time unless explicitly approved.

### Proposed model: `referral_attributions`

| Column | Purpose |
| --- | --- |
| `id` | Immutable internal identifier |
| `referrer_user_id` | Direct referrer; FK to `users` |
| `referred_user_id` | Investor generating fees; FK, **unique** |
| `referral_token_id` | Token used during registration |
| `status` | `PENDING`, `ACTIVE`, `BLOCKED`, `CAPPED` |
| `commission_rate_bps` | Snapshotted contract rate (e.g., 2,000 bps = 20%) |
| `cap_usdc_micros` | Snapshotted per-investor lifetime limit |
| `earned_usdc_micros` | Optional cached running total, only maintained transactionally with ledger |
| `created_at`, `effective_at`, `updated_at` | Audit boundaries |

Capture the agreement's economic terms when attribution becomes effective, or implement a separately versioned rate policy with explicit prospective-only changes. A rate or cap change must never silently rewrite historical commissions.

## 4. Calculation and accounting rules

For each eligible finalized `position_trade_pnl` row:

1. Verify `status = SETTLED`, `settledAt IS NOT NULL` and `platformFeeUsdcMicros IS NOT NULL`. The fee must be **strictly positive**. Zero fees, losing events without assessed fee, and unsettled snapshots generate **no commission**.
2. Find an active, qualified direct referral attribution using **`position_trade_pnl.user_id`**. The platform/system user is not eligible.
3. Ensure the settlement occurred after the referral became effective, and the row has not been commissioned before.
4. Compute integer micro-USDC commission with a documented deterministic rounding policy, for example **floor**: `grossCommissionMicros = floor(feeMicros * rateBps / 10_000)`. Use `bigint` arithmetic only.
5. Under a lock on the attribution (or equivalent serializable transaction), calculate `remainingMicros = max(0, capMicros - previouslyCreditedAndReservedMicros)` and `commissionMicros = min(grossCommissionMicros, remainingMicros)`.
6. Never pay more than the available attributable platform revenue. Ensure fee recognition, the platform payout balance and commission liability reconcile before creating spendable credits.
7. If `commissionMicros = 0`, record a deterministically skipped/capped result as useful for audits, without transferring funds.

**Important:** `position_trade_pnl.platform_fee_usdc_micros` stays the **gross fee originally assessed**. Do not replace or decrement it by the referral commission; keep the investor's `net_pnl_usdc_micros` untouched. Referral commission is Zenvest's distribution of already-earned fees, not a new investor debit.

Use **one unique commission record per `position_trade_pnl.id`** (or a uniqueness policy that permits precisely scoped adjustments/reversals while forbidding repeat initial awards). An investor can own multiple positions, so commission is computed on each position's independently assessed fee, not once per `StrategyTrade` or by aggregating rows without unique identities.

## 5. Commission ledger and transfers

### Proposed model: `referral_commissions`

| Column | Purpose |
| --- | --- |
| `id` | Immutable commission ID |
| `attribution_id` | Direct referral relationship |
| `position_trade_pnl_id` | Unique origin of initial commission |
| `referrer_user_id`, `referred_user_id` | Snapshot of participants |
| `source_fee_usdc_micros` | Exact gross fee basis at settlement |
| `commission_rate_bps` | Rate used for calculation |
| `commission_usdc_micros` | Capped calculated amount |
| `status` | `PENDING`, `CREDITED`, `REVERSED`, `BLOCKED` (define transitions) |
| `send_id` | Unique nullable FK to `sends`, once transferred |
| `created_at`, `credited_at`, `reversed_at` | Audit history |
| `reversal_reason` | Documented correction when applicable |

Keep immutable adjustment/reversal events rather than deleting commission records. Where clawbacks are operationally required, define a compliant negative adjustment/recovery flow and never silently drive a customer's spendable balance negative.

### `@zenvest` system account

- Reserve the handle **`zenvest`** now and permanently in registration, handle changes, administration and database constraints. It fits the existing eight-character handle limit.
- Bootstrap exactly one server-owned platform identity, accessible only by privileged internal payment code. It must **not** behave like an ordinary login-enabled customer. A marker/role and server-only authorization are required; `Role` currently contains only `USER` and `ADMIN`, so the precise representation is an implementation decision.
- Do not rely on display handle alone for authority: configure and resolve a stable platform user ID and verify it when paying rewards.
- Funds must be transferred from **a real, reconciled, sufficiently funded platform balance**. A new `@zenvest` account with a zero `unallocated` balance cannot manufacture referral credits. Define how earned platform fees are recognized and moved into this funded balance before release.
- Prefer extending the existing atomic internal `Send` service with a **server-only system transfer** method. Reuse its debit/credit guarantees and stable idempotency key (e.g., `referral:{commissionId}`), but don't invoke the customer-facing authenticated Send endpoint as a background worker.
- Link each successful transfer and commission bidirectionally for traceability. Do not pay through an external blockchain withdrawal when an internal USDC transfer suffices.

### Transaction and failure handling

The settlement worker may be retried or run concurrently. Use a durable payout work item / outbox and a transactionally consistent state machine:

1. **Settle trade first**: commit the investor's final `PositionTradePnl` row and fee.
2. **Accrue commission**: upsert initial commission with a unique source ID; lock attribution when consuming remaining cap; atomically reserve cap capacity.
3. **Verify funding**: ensure the `@zenvest` ledger has recognized funds sufficient for the payment. If not, preserve a pending liability and retry safely; do not issue an unfunded credit.
4. **Transfer once**: in a DB transaction, debit the platform account, credit the referrer, insert one `Send` with the unique commission-derived key, link it to the commission, mark credited, and commit as an indivisible operation.
5. **Recover**: if the worker crashes before commit, retry; if after commit, find the existing transfer and mark the work complete rather than paying again.

Define how pending reserved cap is released on rejected/voided commissions and how ledger corrections affect caps. Accounting invariants include: **one initial commission per settled P&L row; one payout per commission; no negative source balance; paid + pending cap reservations <= cap; sum(debits) = sum(credits)** for internal sends.

Avoid invoking a nested external side effect inside a DB transaction. Use durable retryable work, unique keys and operational alerting for stuck pending or unreconciled settlements.

## 6. Investor-facing experience

### Entry point and page

- Add **Refer & earn** as a Settings quick action that opens `/referrals`; do not restore a fifth mobile tab.
- A premium Zenvest-styled invitation panel with message: **“Invite investors. Earn a share of Zenvest's fees.”**
- Display actual approved rate, cap **per referred investor**, qualifying event and payout timing. Show copy/share referral code and URL.
- Three simple metrics: **Total earned**, **Pending rewards**, **Active referrals**. Also show progress and cap remaining **per referred investor**.
- Referral activity rows can show pseudonymized handles/statuses while respecting privacy. Statuses: invited, registered, active/fee-generating, capped, blocked.
- A reward history lists date, earned USDC, credited/pending status and the applicable originating trade-event reference when user-visible.
- Wallet activity displays **Referral reward** and **Received from @zenvest** with a verified platform badge; link to transfer details. Never mix these entries into settled trade history or portfolio P&L charts.
- Empty states must render complete, non-fabricated layout, just as Dashboard charts do without account data.

### Transparency and safety

- Show eligibility and exclusion terms, per-user maximum, payout status and that earnings are variable and only arise from **fees paid by referred investors**.
- Do not show other users' deposit addresses, account balances, positions or identifiable financial activity to the referrer.
- Public promotion and program terms require legal/regulatory review (including compensation for investment referrals, financial promotions, relevant jurisdictions, taxes, sanctions and identity/anti-fraud checks) before enabling referrals.

## 7. Implementation phases

1. **Decisions and approval:** finalize percentage/cap, eligibility, effective date, countries, retention, privacy, reversal and compliance policy.
2. **Identity and migrations:** protect `@zenvest`, establish a server-only funded platform identity, add referral token/attribution/commission tables with unique constraints and indexes, create forward-only Prisma migration and backfill policy.
3. **Registration flow:** signed referral link/token resolution, one-time attribution, abuse protections and immutable referral provenance.
4. **Settlement integration:** emit/upsert commission work from finalized per-position fees. Keep existing P&L posting behavior unchanged.
5. **Funding and payout:** outbox, cap locking, idempotent internal USDC transfer `@zenvest → @referrer`, retries, ledger reconciliations and alerts.
6. **UX and reporting:** Settings entry, referral dashboard, real-time/polled summaries, Wallet labels, user history, admin support/audit tools.
7. **Controlled rollout:** disabled-by-default feature flag, internal QA accounts, reconciliation dry runs and staged enablement.

## 8. Acceptance criteria and critical tests

- A referred investor's **settled, positive** `position_trade_pnl.platformFeeUsdcMicros` can generate a single correctly rounded commission tied to that row. No unqualified user or unsettled/zero fee generates one.
- A user's fees produce rewards **only for their own direct referrer**, never for unrelated referrers, another referral tier or the whole platform.
- The referral reward does not change the investor's `grossPnl`, `platformFee` or `netPnl`.
- Cap is enforced individually per `referredUserId` even with concurrent trades, multiple positions, retry storms and partial-cap events.
- Concurrent workers and duplicate webhook/settlement deliveries never create duplicate commissions or duplicate `Send` rows.
- Every credited commission matches one internal transfer from the stable official `@zenvest` user ID, with matching USDC amount, platform debit and referrer credit; unfunded transfers remain pending rather than minting balance.
- Unauthorized creation/login-as-`@zenvest` is impossible through customer routes, including race conditions and case-normalization bypass.
- Refunds, trade corrections, cancelled commissions and disputed referrals have auditable resolution without hidden P&L changes.
- The referral UI and Wallet list real data, protect referred investors' privacy and show empty/pending states accurately.
- Historical positions/trades before eligibility do not automatically generate retroactive commissions.
- Tests cover rate arithmetic in integer micros, no fee, negative/zero P&L, exact cap, partial cap, referral changes, pagination and reconciled historical reporting.

## 9. Open decisions (do not silently assume)

1. Actual referral percentage and cap: currently **illustrative only** (20%, 100 USDC per referred investor).
2. Qualifying and expiration rules, restricted countries, and whether reward eligibility starts at account registration or a later verification step.
3. Platform fee custody/revenue recognition and funding path into `@zenvest`'s spendable balance; this is essential before payout.
4. Exact handling of fee reversals, refunds, tax records, AML/fraud holds and cap restoration.
5. Referral attribution immutability, code rotation and pre-existing customer eligibility.
6. Whether to show the referred user's handle or privacy-preserving masked identity.
7. Payout timing (immediately after reconciliation versus a defined holding period).

**Not part of this change:** no implementation code, database migration, new page, new reserved account or money movement is deployed by this document.
