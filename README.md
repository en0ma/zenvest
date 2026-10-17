# Zenvest

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
