# PR #3 — Vercel deployment and external bot telemetry

## Objective
Prepare Zenvest for Vercel-hosted Next.js deployment and introduce database models/read-only admin monitoring for the bot running outside this repository.

## Repository audit
Base: main (PR #2 merged). Next.js + Prisma/PostgreSQL, authentication and demo dashboard exist. No Vercel account connection, provisioned database, bot connector or user-facing live financial ledger is configured.

## Requirement matrix
| Requirement | Files | Verification | Status |
|---|---|---|---|
| Vercel deployment documentation | docs/deployment-and-bot.md | Docs review | Implemented |
| External bot state snapshot | prisma/schema.prisma, migration | Prisma validate; migration review | Implemented; CI pending |
| Trade history with idempotent IDs | prisma/schema.prisma, migration | Prisma validate; migration review | Implemented; CI pending |
| Admin-only read-only bot status | src/app/admin/bot/page.tsx | Build and role code audit | Implemented; CI pending |
| Staleness & exact money formatting | src/lib/bot-telemetry.ts | Unit tests | Implemented; CI pending |
| Admin navigation | src/app/admin/page.tsx | Build | Implemented; CI pending |
| Live Vercel project and database | External Vercel account/DB | Deployed smoke test | Blocked on Vercel connection and credentials |

## Operational and security rules
- Bot execution, Kalshi credentials, and strategies remain outside Zenvest.
- Ingestor must be scoped to telemetry tables only. No investor balance mutation.
- Trading P&L and releasable USDC are indicative; investor equity and withdrawal authorization require separate ledger/custody reconciliation.
- No KYC UI is introduced. Regulated activities still require legal/compliance handling.
- No real funds flow is enabled in this scope.

## Verification status
Pending GitHub Actions CI. Provisioning and real bot integration cannot be verified without connected Vercel project and bot integration details.
