# Blockradar — Solana USDC deposits (draft)

This feature branch adds dedicated deposit-address activation and a provider-authenticated USDC confirmation pathway. **Keep disabled until integration testing and operational reviews are complete.** Withdrawals, custody reconciliation, sweeping, and live investment allocation are separate work.

## Server environment

- `BLOCK_RADAR_API_KEY`: secret Blockradar key for the Solana master wallet. Never expose to the client.
- `BLOCK_RADAR_MASTER_WALLET_ID`: exact Solana master wallet ID.
- `BLOCKRADAR_SOLANA_USDC_MINT`: exact supported USDC mint from the configured network, matched against the deposit webhook asset address.
- `BLOCKRADAR_DEPOSITS_ENABLED`: leave unset or `false` until approved for use.

## Setup

1. Configure the Solana master wallet and **only the intended USDC asset** in Blockradar. Configure provider-managed Solana token-account requirements and sufficient native SOL for sweeping as appropriate.
2. Register `https://www.zenvest.market/api/webhooks/blockradar` in Blockradar's webhook settings.
3. Provide the four environment variables through trusted server-side environment storage, not GitHub or frontend code.
4. Apply the Prisma migration in a reviewed deployment.
5. Exercise test scenarios: independent investor addresses, concurrent activation, network mismatch, wrong mint, under/over precision amounts, spoofed webhooks, replayed `deposit.success`, duplicate deliveries, database failures, and missed-webhook reconciliation.
6. Confirm the correct Blockradar Solana **mainnet** webhook `network` value before enabling production (the route currently accepts `mainnet` or `mainnet-beta` only).
7. Confirm Blockradar's payload HMAC is computed over the exact received JSON body and validate the sample webhook delivered by the configured master wallet.

## Safety properties

- Activation requires an authenticated user, creates at most one wallet record per investor and never exposes a private key.
- If a provider create request fails ambiguously, activation stays in an error state for manual reconciliation. Do not create a second address blindly.
- Webhooks authenticate via HMAC-SHA512 `x-blockradar-signature` before JSON parsing.
- Only `deposit.success` events with confirmed SUCCESS DEPOSIT, matching Solana network, exactly configured USDC mint, provider address ownership and valid 6-decimal amount may credit the ledger.
- `BlockchainDeposit.providerTransactionId` has a unique database constraint. Record, portfolio increments, and `DEPOSIT_CONFIRMED` activity occur atomically with a serializable transaction. No deposit is credited by `deposit.processing` or sweep events.
- Every 1 USDC corresponds to exactly 1,000,000 `BigInt` micros; no floating-point arithmetic.
- Blockchain balance and internal unallocated capital are different. A confirmed deposit increases the latter but does not automatically allocate funds to the trading bot.

## Follow-up required before production

Add provider transaction reconciliation and operational alerts; confirm custody and auto-sweeping configuration, regulatory/eligibility requirements and transaction policy. Review network and mint identifiers against real Blockradar Solana test payloads. Provide user deposit history and QR generation, and build automated tests against fixture webhook payloads. Configure webhook replay recovery and account for unsupported token transfers.

References: https://docs.blockradar.co/en/essentials/addresses and https://docs.blockradar.co/en/utilities/webhooks
