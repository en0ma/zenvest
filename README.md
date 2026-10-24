# Zenvest

**An investor operations and USDC custody application — development / pre-production**

[![Zenvest CI](https://github.com/en0ma/zenvest/actions/workflows/ci.yml/badge.svg)](https://github.com/en0ma/zenvest/actions/workflows/ci.yml)

Zenvest is built with **Next.js (App Router), TypeScript, Prisma, PostgreSQL and NextAuth**, with Blockradar-backed USDC custody workflows and position/strategy accounting. The repository includes investor onboarding, wallet operations, withdrawal requests, strategy allocation and closing workflows, trade P&L processing, authenticated internal jobs, administrative review surfaces and source-instrumented tests.

> **Deployment status:** This repository is under active development. Passing CI is **not** authorization to accept customer deposits, send production payouts or activate Kalshi trading. Several provider integrations and operational controls remain incomplete. See [Release gates](#release-gates-before-production-use).

## Architecture and funds flows

**[Open the editable Excalidraw architecture and funds-flow diagram](docs/architecture/zenvest-fund-flows.excalidraw)**

The diagram is the maintained visual starting point for the investor, API, custody, worker and database boundaries. Open the linked `.excalidraw` file using [Excalidraw](https://excalidraw.com) to inspect or edit the complete diagram. It covers deposits, withdrawals, allocation to Kalshi, returns/deallocation, strategy P&L and separate platform revenue flows.

| Component | Responsibility |
| --- | --- |
| **Next.js UI and APIs** | Investor and admin interfaces; request validation; authenticated HTTP boundaries |
| **NextAuth and account services** | Sessions, credential login, activation tokens, password reset and role authorization |
| **PostgreSQL + Prisma** | Durable users, balances, custody events, positions, withdrawals, allocations, treasury records and transaction-safe state |
| **Blockradar** | USDC deposit wallets, master-wallet custody, payouts, sweep events and signed provider callbacks |
| **Financial workers** | Authenticated scheduled processing of withdrawals, allocation batches, webhook queue, P&L and reconciliation |
| **Kalshi-side systems** | Strategy funding, market/trade results and expected return-of-funds interfaces; not all final-receipt integrations are available |
| **Resend** | Transactional account email; configure a verified sender for real delivery |

### How money is represented

All monetary USDC calculations use **integer micro-USDC**, typically `BigInt`, rather than floating-point balances.

- `users.unallocated`: investor capital held as unallocated USDC in the platform's master-custody accounting.
- Position invested equity: capital attributed to an investor position, including eligible settled net trade P&L.
- **Available unallocated** = `max(0, users.unallocated - active allocation holds - active withdrawal gross holds)`.
- Treasury balances and completed transfers track custody locations and verified movements. Investor principal, platform-retained fees and platform profits are distinct accounting categories.

Active withdrawal reservations include `PENDING`, `SUBMITTING`, `PROCESSING` and `REVIEW`. Active allocation reservations also include `CONFIRMING`. A reservation is **not** a completed transfer or an early debit.

### Fund flow 1: investor deposit → master custody → available capital

1. An investor receives a deposit address associated with a verified wallet relationship.
2. Blockradar reports deposit activity; the application authenticates the webhook and validates asset/mint, network, wallet/recipient identity, transaction identity, amount and status.
3. An observed or source-confirmed deposit can be recorded but **does not credit the investor**.
4. After a verified successful sweep into the trusted master wallet, a serializable/idempotent settlement completes the deposit, records its treasury movement and increases `users.unallocated` exactly once.
5. Conflicting provider evidence, unconfirmed custody and duplicate notifications must never cause optimistic or repeated credit.

### Fund flow 2: available capital → withdrawal → investor wallet

1. The withdrawal endpoint validates the Solana address, positive USDC amount, server-quoted fee, acceptance of the fee quote and available capital. It explicitly enforces **gross = net payout + fee**; the database also has an accounting check constraint.
2. A `Withdrawal` row is created in `PENDING`. Its **gross** amount is reserved rather than immediately debited.
3. The worker atomically claims the request, revalidates arithmetic and available capital, checks master-wallet custody and submits a payout to Blockradar.
4. Blockradar acceptance alone is **not** final settlement. Only a signed, field-matched successful provider callback can complete the operation.
5. Verified success atomically marks the withdrawal `COMPLETED`, debits the gross investor amount once, creates the completed treasury transfer and accounts for retained fees.
6. Locally invalid or non-fundable requests become `FAILED` before payout submission. Ambiguous provider results remain in `REVIEW` for reconciliation; the worker must not blindly resubmit a possibly paid transfer.

The Prisma model is **`Withdrawal`**, mapped to the existing PostgreSQL table **`withdrawals`**. The table includes `status` and `failure_code` columns for operational outcomes.

### Fund flow 3: unallocated capital → strategy allocation → invested position

1. An investor allocation request reserves capital in a position event.
2. The allocation worker batches eligible events into a strategy-level outbound transfer intent. It does not immediately reduce `users.unallocated` or increase the invested position.
3. An authenticated, matched Blockradar withdrawal success establishes **source-side** confirmation and advances processing to `CONFIRMING`; it does **not** prove Kalshi received the funds.
4. Final allocation accounting requires a **separate authenticated Kalshi destination receipt**. Only after both sides are verified may the workflow complete, debit unallocated principal, increase invested equity and finalize treasury attribution.

**Integration boundary:** The independent Kalshi destination-receipt finalizer is not connected for live use. A source-confirmed transfer must not be described as a completed investment allocation.

### Fund flow 4: invested position → deallocation / close → returned capital

1. A deallocation reduces invested capital only after validated return-of-funds settlement. A separate explicit close request sets a position to `CLOSING`.
2. The coordinator waits for eligible prior trade P&L, checks unsettled exposures and creates an appropriate final deallocation request.
3. An independently authenticated Kalshi return and matched master-custody receipt are required before a verified return can reduce position equity and credit `users.unallocated`.
4. Closing can reach `CLOSED` only when the eligible position funds are fully and verifiably returned.

**Integration boundary:** The Kalshi-to-master return transport is not integrated; the coordinator does not simulate a completed return or credit unverified funds.

### Fund flow 5: immutable trade exposure → realized position P&L → platform share

- Position participation is captured in an immutable **pre-trade exposure snapshot**. Pending deposits and unallocated funds do not participate in trade P&L.
- The P&L worker allocates the authenticated, settled trade result among eligible positions using integer-micro accounting and deterministic allocation rules. Net gains/losses adjust invested position equity; they do **not** automatically credit withdrawable `users.unallocated`.
- The platform profit share is computed separately from investor net P&L. The `K_BANK` / `M_BANK` concepts distinguish profit held at Kalshi from profit verified in master custody.
- Transferring platform profits into master custody, subsequent platform withdrawals, and related external receipt flows are **future integrations**, not implied by a calculated fee.

For implementation contracts and important unresolved boundaries, see:

- [Treasury buckets and platform flows](docs/architecture/treasury-buckets-and-platform-flows.md)
- [Unified position and strategy events](docs/architecture/unified-position-strategy-events.md)
- [Per-trade position P&L](docs/architecture/per-trade-position-pnl.md)
- [Audit and test plan](docs/architecture/pr39-audit-and-test-plan.md)

## Security and financial invariants

- **Authentication and authorization:** user routes require an authenticated account; admin and internal cron endpoints enforce their own access boundaries. Account-action tokens are hashed, purpose-bound and single-use.
- **Custody before settlement:** never credit deposits or investment returns from an observation alone; do not debit final withdrawals until verified success.
- **No duplicate movement:** unique references, conditional state transitions, serializable transactions, durable idempotency and replay-safe webhook processing.
- **Explicit reconciliation:** ambiguous remote outcomes are review work, **not** permission to resubmit or silently mark success.
- **Fail closed:** invalid amounts, unexpected wallet/network/mint/recipient and incompatible statuses must not cause balance movement.
- **Separation of funds:** investor principal and platform fees/profits are accounted for independently.
- **Operational review:** a successful build or passing test suite does not establish legal or operational readiness for real funds.

## Repository layout

```text
src/
  app/                   Next.js pages, investor and admin APIs, internal cron endpoints
  components/            UI components
  lib/                   Authentication, custody, accounting, workers, settlement
prisma/
  schema.prisma          Database models
  migrations/            Versioned schema changes
scripts/
  check-*.mjs            PostgreSQL and HTTP integration checks
  run-coverage.mjs       Instrumented coverage runner
  coverage-summary.mjs   CI reporting and coverage gates
tests/                   TypeScript / Node unit tests
docs/architecture/       Financial design contracts and editable Excalidraw diagram
.github/workflows/ci.yml CI and production migration workflow
```

## Local development

**Prerequisites:** Node.js **22.10+**, npm and PostgreSQL.

```bash
npm install
cp .env.example .env.local
# Configure DATABASE_URL, NEXTAUTH_SECRET and NEXTAUTH_URL
npx prisma validate
npx prisma migrate deploy
npm run dev
```

Open `http://localhost:3000`. The investor dashboard is at `/dashboard`; operational/admin views require appropriate authorization.

Use a **local, disposable development database** for schema changes and test fixtures. `prisma migrate deploy` runs pending migrations against whichever database `DATABASE_URL` points to: verify the target before executing it. For account emails, configure `RESEND_API_KEY` and `EMAIL_FROM` using a verified sender; do not put provider secrets in source control. Additional custody/provider variables depend on the workflows being exercised.

## Tests and CI

```bash
npm run typecheck
npm test
npm run test:coverage
npm run build
```

The GitHub CI pipeline runs with **PostgreSQL 16**, applies migrations to a disposable `zenvest_ci` database, seeds deterministic test fixtures, executes source-instrumented Node and PostgreSQL integration tests, publishes a coverage summary/artifact, typechecks, builds and verifies built HTTP route security.

**Coverage gates:** minimum **85% line coverage** and **80% branch coverage** over `src/lib/**` and `src/app/api/**`. The workflow summary and PR coverage comment contain the current results; the badge shows CI status, not a coverage percentage. Integration checks mock remote provider HTTP while retaining real PostgreSQL transactional behavior.

**Never run CI fixtures against production.** Test scripts protect against database URLs that do not designate `zenvest_ci`.

## Release gates before production use

This branch is an implementation and audit workstream, **not production approval**. Before live custody or market operation, resolve and independently verify at least:

1. Independently authenticated Kalshi destination funding confirmations and the Kalshi-to-master return transport.
2. Full cross-worker custody reservation, late-confirmation reconciliation and operational recovery for ambiguous provider states.
3. Platform profit custody/transfer workflows, auditability and treasury reconciliation.
4. Legal/regulatory review, identity/AML controls where applicable, provider terms, secrets management, monitoring, alerting and operational approvals.
5. End-to-end readiness of migrations, rollbacks, custody integration and reconciliation in an approved deployment environment.

**Important deployment behavior:** `.github/workflows/ci.yml` contains a **production database migration job on successful pushes to `main`**. Merging into `main` may therefore trigger production schema migrations automatically if the workflow is configured with the required `DATABASE_URL` secret. Inspect and explicitly approve this before merging; do not treat draft-branch CI success as consent to apply production migrations.

## Contribution and operational discipline

Keep provider secrets out of commits, review schema changes alongside their corresponding migrations, and ensure finance-facing state transitions have idempotent integration coverage. Avoid manual edits to settled transfers or historical P&L without audited correction workflows.

The detailed Excalidraw diagram is maintained as an editable source file so new contributors can update the architecture when provider integrations and settlement guarantees change.
