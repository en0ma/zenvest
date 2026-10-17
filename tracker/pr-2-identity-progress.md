# PR #2 — identity and data foundation

## Objective and scope
Implement persistent PostgreSQL investor identity records and secure login/registration with protected investor/admin routes. Keep all balances and finance flows demo-only.

## Audit
- PR #1 merged on main as 3caeb693f31aa9116dd0befd9f68606368bba512.
- Existing Next.js 15 App Router + React 19, TypeScript, demo-only dashboard/admin.
- No database, authentication, sign-in, authorization or registration exists.
- No real payment or Kalshi API implementation; these remain out of scope.
- No PR/issue existed for this new milestone; create feature PR against main.

## Acceptance criteria and matrix
| Requirement | Files | Verification | State |
|---|---|---|---|
| PostgreSQL user schema and migration | prisma/schema.prisma, prisma/migrations | Prisma validate + migration inspection | Implemented; CI passed |
| Secure hashed password register | api/register, lib/auth | Unit tests + CI typecheck | Implemented; CI passed |
| Credentials login & sessions | api/auth, lib/auth | Build + typecheck | Implemented; CI passed |
| Investor dashboard requires session | dashboard/page | Build + code audit | Implemented; CI passed |
| Admin dashboard requires ADMIN role | admin/page | Build + code audit | Implemented; CI passed |
| Anonymous homepage/login/register | login, register, page | Build | Implemented; CI passed |
| Config and onboarding docs | .env.example, README | manual review | Implemented; CI passed |

## Execution sequence
1. Define Prisma schema and migration.
2. Implement server-side authentication, registration, and route authorization.
3. Add UI and secure logout.
4. Extend CI validation and tests.
5. Review full diff and GitHub CI; record defects and fixes.

## Risks
- Running production database migrations requires a real PostgreSQL instance.
- Auth secrets and DATABASE_URL must be configured by the deployer.
- No KYC UI in scope; any real-money launch still needs legal review and compliant identity/AML controls where applicable.
- Demonstration balances must never be conflated with live investor account equity.

## Status
Implementation committed. GitHub Actions run 39042114060 succeeded: npm install, Prisma schema validate, npm test, TypeScript typecheck and production build. Actual database migration against a live PostgreSQL instance was not run, and end-to-end login/browser tests remain out of scope for this CI run. Review role gating and external deployment configuration before public access.

## Email verification & recovery extension (2026-10-17)
- Added `emailVerifiedAt`, `sessionVersion`, and hashed expiring `ActionToken` records with PostgreSQL migration.
- Added email activation, resend activation, forgot-password and password-reset screens and API endpoints.
- Verification required for credentials sign-in; successful password reset invalidates prior JWT sessions using DB-backed session version.
- Tokens are 32 random bytes, SHA-256 hashed at rest, purpose-bound, time-limited and one-use.
- Provider: Resend, configured via `RESEND_API_KEY` and `EMAIL_FROM`. No credentials committed.
- Per-user email link request throttling added (60 seconds); **IP-based global abuse protection still required before public deployment**.
- CI run 39042608808 passed install, Prisma validation, tests, typecheck and build before final throttle change; recheck the latest commit.
- **Integration work outstanding before production**: apply migrations to a provisioned PostgreSQL database, verify real email delivery, test registration/activation/reset end-to-end, and configure anti-abuse controls. No live capital flows enabled.
