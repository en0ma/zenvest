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
