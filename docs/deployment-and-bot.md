# Vercel deployment and external bot contract

## Architecture
- Vercel runs only the Next.js frontend, authenticated portal APIs and server-rendered admin pages.
- An independently hosted **existing bot** runs its own trading strategy and Kalshi connectivity. It is not deployed in this repo and must never share trading credentials with Vercel.
- Managed PostgreSQL hosts portal records and separate `bot_status` and `bot_trades` telemetry tables. Use scoped DB roles or a restricted ingestion service for the external bot.
- The bot periodically upserts `bot_status` with UTC `as_of`, and records history in `bot_trades` with a unique `external_trade_id` to support idempotency.
- Portal admin route `/admin/bot` is **read-only** and restricts access to a currently active ADMIN user.
- `releasable_funds_usdc_micros` is only bot-reported liquidity, **not** an approved investor withdrawal amount. Releasing capital must separately reconcile unsettled exposures, custody, fx transfers and investor-level locked allocations.

## Vercel setup
1. In Vercel, import GitHub `en0ma/zenvest` as a Next.js project. Vercel will run `npm install` and `npm run build`.
2. Connect a managed PostgreSQL database (e.g. Prisma Postgres via the Vercel Marketplace); configure pooled `DATABASE_URL` for serverless app traffic.
3. Configure `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (canonical HTTPS URL), `RESEND_API_KEY` and `EMAIL_FROM` with a verified sender domain. Add domain DNS records as required by the email provider. Do not commit secrets.
4. Apply versioned Prisma migrations to the database through a controlled release process: `npx prisma migrate deploy`. **Do not auto-run migrations during every Vercel build**.
5. Deploy and run end-to-end checks for registration, activation, password reset, investor/admin permissions and `/admin/bot`.
6. Until abuse prevention, integration tests and financial/legal approval are done, keep public sign-up limited and all money flows disabled.

## Bot data contract
- `bot_status.bot_id`: stable opaque identifier.
- `state`: OFFLINE, IDLE, MONITORING, TRADING, PAUSED or ERROR.
- `current_event_ticker`, `current_event_closes_at`: current Kalshi event identification and UTC close.
- `inventory_yes_contracts`, `inventory_no_contracts`: current open exposure.
- `available_funds_usdc_micros`: reported trading funds; `releasable_funds_usdc_micros`: bot's estimated funds not currently required for trades.
- `realized_pnl_usdc_micros`, `unrealized_pnl_usdc_micros`: bot-level P&L snapshots, NOT investor profit distributions.
- `as_of`: bot-generated status timestamp; UI marks records more than 90 seconds old as stale.
- `bot_trades`: stable external ID, event, side, contracts, cost/fees/payout in integer USDC micro-units, opened/settled timestamps and realized P&L.

The bot should not be given unrestricted write access to user, wallet, ledger, roles or allocation tables. If the bot has a different persistence store, use a signed ingestion bridge rather than sharing database credentials. Trade settlement must be reconciled independently before investor P&L is posted.

## Limitations
No live telemetry connection has been configured, no Vercel deployment is active, and the database migration has not been run on a provisioned instance. The investor dashboard remains a clearly labeled simulation.
