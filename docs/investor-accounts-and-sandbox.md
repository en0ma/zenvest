# Verified accounts and sandbox investor portfolios

## Current features
- Existing PostgreSQL credential registration, email activation, login, forgot password, token-based reset and role-checked pages remain in effect.
- Newly registered investors get a zero-valued, isolated `investor_portfolios` row automatically.
- Authenticated `/dashboard` reads ONLY the portfolio belonging to the server-authenticated user's ID, not a supplied route/query parameter. The page is labeled **sandbox** and disallows real payments and withdrawals.
- All money is stored in integer kobo via PostgreSQL BIGINT and rendered exactly.
- Public investor/admin previews still use hard-coded illustrative data and do not require login.
- Bot trading data is in separate read-only telemetry tables. Bot P&L is **not** auto-credited to investors.

## Manual optional seeding (never in production CI)
After migrations are applied and a real user has registered and activated their email:
```
SEED_SANDBOX_EMAIL=verified-investor@example.com npm run db:seed:sandbox
```
Run only with intentionally chosen **non-production demo credentials and a database authorized for sandbox testing**. This script seeds **one existing verified INVESTOR** with demo numbers, refuses to touch an existing nonempty portfolio, and never creates/activates a fake user or grants an admin role. It doesn't write to trading telemetry, custody, or accounting ledgers. No automatic seed is run by GitHub Actions.

## Deployment requirements
Configure Vercel production secrets `NEXTAUTH_SECRET` (at least 32 bytes of cryptographically random material), `NEXTAUTH_URL` (canonical HTTPS domain), `RESEND_API_KEY`, and `EMAIL_FROM` (verified domain). Keep those in Vercel's secret manager, never the repository. Apply the migration `20261017030000_investor_sandbox` using GitHub Actions `DATABASE_URL`.

**Important:** Email delivery, auth and password reset still require a live integration test; rate limiting and abuse protection require hardening prior to public registration. Do not treat these sandbox aggregates as an audited ledger or genuine investor equity.

## CI scope
CI validates schema, tests, typecheck and build on PRs, then attempts protected main-only Prisma migrations through the configured repository secret. Migrations of this branch are not run on PRs.
