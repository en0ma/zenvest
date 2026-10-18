# Solana USDC withdrawals (Blockradar)

This feature is **disabled by default**. Do not enable in production until the migration, verified admin access, Blockradar test-mode payout, webhook signature verification, and reconciliation tests have succeeded.

## Configuration
- `BLOCKRADAR_WITHDRAWALS_ENABLED=true` enables new withdrawal requests and admin broadcast. Omit or set to `false` until ready. Signed settlement webhooks for existing payouts continue even if new withdrawal requests are paused.
- `BLOCKRADAR_SOLANA_USDC_ASSET_ID` is the Blockradar **asset UUID** for the Solana USDC asset on the *same wallet/network* as `BLOCK_RADAR_MASTER_WALLET_ID`. It is **not** the Solana token mint. For the sample testnet webhook, the asset UUID is `1d67218b-a685-4156-a573-9f4aefc654b6`; verify it in the Blockradar dashboard before configuring.
- Existing `BLOCK_RADAR_API_KEY`, `BLOCK_RADAR_MASTER_WALLET_ID` and `BLOCKRADAR_SOLANA_USDC_MINT` remain required.
- Apply `prisma migrate deploy` before setting the flag.

## Flow
1. Authenticated user opens `/withdrawals`, provides an amount in USDC and a Solana destination address.
2. `POST /api/withdrawals` checks unallocated funds and **atomically reserves** the amount by decrementing unallocated and incrementing pending withdrawals. A request is `REQUESTED` and makes **no external transfer**.
3. Before approval, the user may cancel the `REQUESTED` withdrawal; the reserved USDC is restored atomically. After approval, cancellation is unavailable.
4. An authenticated `ADMIN` reviews `/admin/withdrawals`. Approval calls `POST /api/admin/withdrawals/execute` with `{"id":"<withdrawalId>"}`. The server estimates network fees, claims the request exactly once, and submits to Blockradar's `POST /v1/wallets/{walletId}/withdraw`.
5. The reference `zenvest-withdrawal:<withdrawalId>` correlates the broadcast with the signed `withdraw.success` / `withdraw.failed` / `withdraw.cancelled` webhook. Successful confirmed completion clears the pending reserve; failed or cancelled settlement restores unallocated USDC.
6. Duplicate notifications do not change balances again.

## Safety constraints
- Transfers originate from the **master wallet**, because deposit addresses auto-sweep to it.
- All amounts use USDC integer micros; never use floating-point calculations for accounting.
- The withdrawal request must be an unallocated balance reservation, not a deduction from allocated capital.
- The destination address is validated as Solana base58 **syntax**, not recipient ownership or token-account compatibility. Verify destination, network, beneficiary eligibility, compliance, and liquidity before approving.
- The submit operation cannot be safely auto-retried when Blockradar times out or returns a malformed response. The status becomes `REVIEW`; an operator must match the reference in Blockradar/chain and resolve manually. **Do not submit again** merely because of a 502 response.
- Neither approval nor webhook processing auto-retries outbound transfers.
- Note field deliberately omitted: Solana notes are public on-chain memos.
- The signed webhook's `withdraw.success` indicates provider-reported chain completion. Verify actual Solana testnet event shape before enabling mainnet.
- This implementation provides an approval and send workflow; it does not include separate MFA, travel-rule checks, sanctions/AML screening, destination allowlists, withdrawal limits, or independent treasury reconciliation. These controls are required for an actual investor-funds production launch.

API reference: https://docs.blockradar.co/en/use-cases/withdraw-stablecoins
