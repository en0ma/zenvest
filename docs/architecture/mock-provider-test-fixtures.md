# Blockradar fixtures and provider boundary (prelaunch)

Sources checked on 2026-10-21:
- https://docs.blockradar.co/en/utilities/webhooks
- https://docs.blockradar.co/en/use-cases/withdraw-stablecoins
- https://docs.blockradar.co/en/use-cases/deposit-stablecoins

Verified Blockradar API:
- `POST /v1/wallets/{walletId}/withdraw`: `assetId`, `address`, `amount`, `reference` and optional `note`, `metadata`. The payout business layer is currently disabled until wallet availability and safe retry handling are implemented.
- `POST /v1/wallets/{walletId}/withdraw/network-fee`: `assetId`, `address`, `amount`. Documentation shows `data.networkFee`, `data.networkFeeInUSD`, and `data.transactionFee` among the response fields.
- `GET /v1/wallets/{walletId}/balance?assetId={assetId}`: master balance by asset.
- `POST /v1/wallets/{walletId}/transactions/webhooks/resend` with transaction `id`: replay for reconciliation.
- `POST /v1/wallets/{walletId}/addresses`: new investor deposit address.

Verified webhook contract:
- `x-blockradar-signature`: HMAC-SHA512 of raw request body using the wallet API secret; reject tampering.
- `deposit.success`: an on-chain confirmed deposit, **not** proof of sweep into master.
- `deposit.swept.success`: event with `id`, `amountPaid`, `hash`, `confirmed`, `status`, `type`, `network`, `asset`, `wallet`, `recipientAddress`, `assetSwept`, `assetSweptAmount`, `assetSweptHash`, `assetSweptSenderAddress`, `assetSweptRecipientAddress`. Credit the user only after exact sweep checks.
- `withdraw.success`, `withdraw.failed`, `withdraw.cancelled`: include transaction identity/reference, destination, value, status and wallet identity for settlement. Verified success can settle, failure cannot debit user.
- Provider may resend unsuccessful webhook deliveries; handlers must be idempotent.

The published example payloads largely show EVM addresses. Mock data in `tests/blockradar-event-validation.test.ts` is **synthetic Solana/testnet-shaped data following the webhook field contract**, not a captured live Solana payload. Before enabling production transfers, confirm a real Blockradar Solana testnet event matches each field and event source.

Test strategy:
- Mock external Blockradar and Kalshi interactions, test deterministic domain rules independently, and use real disposable PostgreSQL to assert ledger behavior.
- Active unit fixtures test HMAC, exact micro-USDC parsing, sweep custody, strategy cap/availability, and platform profit/withdrawal accounting; the live deposit handler imports the tested validators.
- The Kalshi transfer service is **not implemented**; no invented Kalshi API method/payload may be treated as an established contract. Existing position cron stays monitor-only.
- Full route-level signed-webhook integration, concurrent operations and provider callback replay remain follow-up coverage.

The authoritative prelaunch DB is defined by `prisma/schema.prisma`; historical customer-data preservation is not required and disposable test data may be wiped.

## Withdrawal network-fee estimation (implemented in draft PR)
- Required environment: `BLOCKRADAR_SOLANA_USDC_ASSET_ID` (Blockradar asset UUID, not Solana mint); existing `BLOCK_RADAR_API_KEY` and `BLOCK_RADAR_MASTER_WALLET_ID`.
- Authenticated `POST /api/withdrawals/estimate-fee` calls Blockradar `POST /v1/wallets/{walletId}/withdraw/network-fee`, with `assetId`, `address`, and `amount`.
- Single-estimate response field `data.networkFeeInUSD` is the USD cost to add to the 2 USDC Zenvest service fee; `data.networkFee` is denominated in native Solana gas token and **must not** be treated as USDC.
- Conversion to six-decimal USDC micro amounts **rounds upward** to avoid understating a fractional-micro fee. User withdrawal gross = recipient net USDC + service fee + estimated network fee. UI fetches a quote after valid address/amount, and submission re-quotes server-side, rejecting if fees exceed the user's approved quote.
- `withdrawals.fee_usdc_micros` and linked `treasury_transactions.fee_usdc_micros` hold total (service + network). Successful payout credits only **2 USDC** to retained `treasuries.WITHDRAWAL_FEE`. The network component is not retained platform revenue.
- `tests/withdrawal-network-fee.test.ts` injects sample response objects without calling Blockradar. The actual payout CRON remains intentionally disabled; estimated USD fees may differ from future native-SOL execution cost. Native gas sufficiency and provider fee changes must be checked at actual payout.

## Automated Blockradar wallet discovery and sweep
- Deposit Finder: `POST /v1/wallets/{walletId}/rescan/blocks`, accepts optional `transactionHash`. Every-two-minute cron calls with `{}` for a wallet-wide scan.
- Sweep: `POST /v1/wallets/{walletId}/sweep/assets`, optional `forceSweep` and `transactionId`. Every-two-minute cron calls with `{}` (no forced sweep, no single-transaction override).
- Vercel cron routes: `/api/internal/blockradar-deposit-finder` and `/api/internal/blockradar-sweep-assets`. Both require only `CRON_SECRET` for request authentication and Blockradar wallet credentials for API calls; no environment feature flags control whether these scheduled jobs run.
- The deposit/sweep CRON jobs run on every scheduled invocation without deposit-feature toggle checks. The separately implemented deposit webhook still has its own `BLOCKRADAR_DEPOSITS_ENABLED` gate; configure it to true before expecting account credit. The API response means only that rescan/sweep was *initiated*, not that a deposit was found or funds have been swept. User funds are credited only by the separately authenticated `deposit.swept.success` webhook.
- Calls happen every two minutes only if the Vercel deployment plan permits that frequency. Confirm provider rate limits before enabling both feature flags.
- `tests/blockradar-wallet-actions.test.ts` mocks each endpoint and checks method, headers, body, and provider errors. No real sweep is performed by CI.
