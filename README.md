# Zenvest

[![Zenvest CI](https://github.com/en0ma/zenvest/actions/workflows/ci.yml/badge.svg?branch=feat%2Fearn-investor-positions)](https://github.com/en0ma/zenvest/actions/workflows/ci.yml)

**Test coverage:** CI calculates line, branch, function, and statement coverage on every PR and publishes the current percentages in a continuously updated PR comment and the run's **Summary** tab. Download the `zenvest-coverage` Actions artifact for LCOV data. The CI badge reports build/test status, not a coverage threshold; coverage is currently informational.

Nigerian-naira-denominated investment operations portal (development prototype).

## Status
**Demo mode only.** No actual deposits, withdrawals, trading execution, payment collection, or investment returns are supported. Demo balances and activity are fictional.

## Stack
- Next.js App Router + TypeScript
- Tailwind CSS
- Future production architecture: PostgreSQL double-entry ledger, authenticated backend, custody reconciliation, and trade-by-trade allocation snapshots

## Getting started
```bash
npm install
npm run dev
```
Visit http://localhost:3000. The investor dashboard is at `/dashboard`; the admin prototype is at `/admin`.

## Core invariant
Only capital included in an **immutable allocation snapshot at/before a trade cutoff** participates in that trade's realized profit or loss. Unallocated balances and pending deposits never accrue trading P&L. Pending withdrawals reserve existing equity, and cannot be counted twice. Real-world implementations must reconcile FX conversions, custody transfers, Kalshi fills and settled trades before P&L posting.

## Security and launch gates
- This is visual/demo scaffolding, not a regulated, authenticated, audited financial service.
- No user funds should be accepted or routed through this repository.
- Before enabling live flows, obtain legal/regulatory review for the Nigerian offering and relevant Kalshi rules, and integrate compliant identity/AML processes where required. There is no KYC page in this portal prototype.
- Implement real authentication + role-based authorization, double-entry accounting, idempotency, least privilege, robust reconciliation, dual approval for payouts, audit trails, tests and monitoring before launch.

## Next milestones
1. Authentication, role-based protected routes and database migrations.
2. NGN/USDC ledgers and strict deposit/funding state machines.
3. Trade allocation snapshots, per-trade P&L and high-water-mark fee accounting.
4. Admin settlement and withdrawal workflow with authorization and audit logs.
5. Reconciliation with the existing Kalshi bot in a paper environment.

## Authentication and database (PR #2)
This app has PostgreSQL-backed credentials login and registration. Create a PostgreSQL database, copy `.env.example` to `.env.local`, and set `DATABASE_URL`, `NEXTAUTH_SECRET` and `NEXTAUTH_URL`. Then run `npm install`, `npx prisma migrate deploy` and `npm run dev`.

Only public registration into the `INVESTOR` role is supported. Admin role assignments must be performed by a trusted database administrator via audited deployment procedures; **there is no public admin registration endpoint**. `/dashboard` requires a valid account; `/admin` additionally requires an active administrator role. No KYC UI is included.

**Security boundary:** This is not production-ready: public signup still needs email verification, credential rate limiting, recovery flows, CSRF/abuse monitoring and deployment hardening before public exposure. There are no real funds, investment accounts, bank transfer operations or custody integrations in this milestone.

### Email activation and password recovery
Configure `RESEND_API_KEY` and `EMAIL_FROM` for a verified sender domain. New users require email activation before login. The login screen includes forgot-password and resend-activation flows. Activation links expire after 24 hours, password reset links after 30 minutes; only hashed one-use tokens are stored. Successful password reset increments `sessionVersion` so previously issued sessions are rejected. Request endpoints return non-disclosing responses. Production deployment also requires rate limiting, spam protection and an email delivery job/retry strategy; these are not yet implemented.
