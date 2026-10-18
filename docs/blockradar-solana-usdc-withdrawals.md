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

## Deposit availability: sweep-gated
- `deposit.success` creates a `CONFIRMING` deposit and increases `pendingDepositsUsdcMicros` only. It does **not** make USDC withdrawable.
- `deposit.swept.success` must carry the same provider deposit ID, original hash, verified mint/amount, and proof-of-sweep fields: `assetSwept: true`, `assetSweptHash`, `assetSweptSenderAddress` equal to the user's deposit address, and `assetSweptRecipientAddress` equal to the signed master-wallet address. On acceptance the deposit becomes `CONFIRMED`; pending decreases and deposited/unallocated increase atomically.
- `deposit.swept.failed` is logged but never credits or refunds funds. Investigate and retry sweeping with Blockradar; no automatic availability change.
- A `deposit.swept.success` notification arriving before `deposit.success` can create and confirm the deposit in one database transaction. Duplicate and out-of-order webhooks do not credit twice.
- Existing credited deposit records migrate to `CONFIRMED` to prevent retroactive double crediting.
- The deposit history UI displays `Confirming · awaiting sweep` separately from `Confirmed`.
- **Operational gap:** a missing sweep-success notification can leave a deposit confirming indefinitely. Implement sweep-status reconciliation and alerting before deploying with real funds; Blockradar transaction history and signed webhook resends can be used for recovery.

## Fixed USDC withdrawal fee
- The user enters the **net amount to receive**. Zenvest charges an additional **2.00 USDC fee**, so requesting 10.00 USDC to an external wallet reserves **12.00 USDC** of unallocated funds.
- The outbound Blockradar master-wallet transfer is for **10.00 USDC**, not 12.00 USDC. The 2.00 USDC fee remains in the Zenvest master wallet as a treasury reserve to help fund SOL fees for sweeping and payouts. This fee is **not** a direct SOL gas payment or provider network-fee estimate; operations still must keep the master wallet funded with SOL.
- The fee is stored on the withdrawal record (`feeUsdcMicros`) for an auditable snapshot. `pendingWithdrawalsUsdcMicros` reserves payout **plus** fee, while provider transaction/webhook amount comparisons use payout only.
- On successful signed confirmation, pending withdrawal reserve is released and the fee stays in treasury. On definitive failure or user cancellation before approval, **payout plus fee** are restored to unallocated USDC. Uncertain outcomes remain reserved for manual review; no automatic refund or retry.
- Both user and admin screens display payout, fee, and total charged before operations proceed. The amount field means **amount received**, not amount debited.

## Automated FIFO withdrawal processing

- **No admin approval**: an accepted withdrawal is queued as `PENDING`. The user-facing amount is the net payout; the fixed 2 USDC fee is reserved in their balance with the payout.
- A Vercel cron runs `GET /api/internal/process-withdrawals` each minute, authorized by `CRON_SECRET`; the cron is gated by `BLOCKRADAR_WITHDRAWALS_ENABLED`.
- A dedicated `MasterWalletBalance` row keyed by Blockradar master wallet ID records **accounted** master USDC `confirmedUsdcMicros` funds `reservedUsdcMicros` for submitted withdrawals, and `feeReserveUsdcMicros` retained for operational costs. Signed, verified `deposit.swept.success` increments accounted balance once. Signed payout-success decrements accounted balance and releases the payout reserve; definitive failure only releases the reserve.
- The worker always selects the oldest queued withdrawal by creation time and ID. If **available accounted** master USDC is less than the payout after subtracting payout and operating-fee reserves, it leaves that request queued and does **not** skip to newer requests. Requests are claimed under a Serializable transaction with a master-wallet liquidity reservation, preventing competing workers from overbooking the balance.
- The selected withdrawal transitions `PENDING → PROCESSING`. Provider submission uses a stable request reference. Only a signed, validated provider withdrawal webhook moves it to `SUCCESS` (or `FAILED` for a definitive failure). A provider timeout or ambiguous response moves it to `REVIEW` with the liquidity reserve held: **never auto-submit it again**.
- The former admin execution endpoint returns 410; the admin page is monitoring-only.
- **Required production reconciliation:** the balance row is an **event-derived accounting balance**, not a live Blockradar or Solana account balance. It starts at zero and does **not** incorporate sweeps that preceded this schema's deployment, external master-wallet transfers, gas conversion or provider-side adjustments. Bootstrap and regularly reconcile it against the actual master-wallet USDC token balance using a verified provider/blockchain API, with alerts and controlled discrepancy resolution. Until that is implemented and validated, do not enable automated real-funds payouts.
- **Vercel scheduler**: once-a-minute cron requires Vercel Pro or Enterprise. A Hobby deployment cannot deploy this cadence.

- Successfully completed withdrawals add the 2 USDC fee to the master-wallet **fee reserve** (not to payout liquidity). The fee reserve must be reconciled when treasury converts or spends USDC to obtain SOL for network gas; automatic SOL conversion is not implemented.

## Gross withdrawal / net payout contract (current)
- The user enters the **gross amount deducted from unallocated balance**. The UI validates gross <= available unallocated USDC, gross > 2 USDC, and Solana destination syntax. It displays the expected net payout (gross minus the fixed 2 USDC fee) and enables submit only when valid.
- The server atomically revalidates unallocated funds before recording the request. The **same `InvestorWithdrawal` table is the queue** (no separate queue table), and records `grossUsdcMicros`, `amountUsdcMicros` (net), `feeUsdcMicros`, `asset`, destination, status, timestamps, provider ID and transaction hash.
- Example: enter 10 USDC gross, reserve 10, pay 8 USDC net, retain 2 USDC as operating fee. Rejection or definitive failure restores 10 USDC.
- The minute cron considers pending rows in creation order and selects the **oldest that fits available master-wallet payout liquidity**, checking up to 100 oldest pending records per invocation. Larger older requests may remain queued while smaller newer payouts progress.
- The backend remains authoritative. Browser balance is a snapshot and can change between rendering and submission.

## Multiple pending requests and idempotency
- Users can submit multiple independent withdrawals while others remain PENDING or PROCESSING, subject to the **remaining unallocated USDC**. The portfolio already decrements unallocated when each gross request is created; `pendingWithdrawalsUsdcMicros` is a reserved reporting counter and must not be subtracted a second time from `unallocatedUsdcMicros`.
- `allocatedUsdcMicros` represents capital assigned to active strategies and is **not** spendable until deallocated. The actual withdrawal requestable balance is therefore **unallocatedUsdcMicros**, which already reflects all pending/processing requests. If the business later allows withdrawals of allocated capital, deallocation must happen first with its own settlement and locking controls.
- The form requires a recipient **Solana wallet address**, validates gross amount > 2 USDC, previews net payout, and disables submit for insufficient unallocated balance, invalid address, or in-flight submit.
- Every form submission includes a client-generated stable UUID `idempotencyKey`, also stored under a database unique constraint on `(userId, idempotencyKey)`. Repeated HTTP attempts with the same key and unchanged gross/recipient return the existing withdrawal; changed payloads return 409. A new intentional request receives a new key.
- A SERIALIZABLE database transaction performs the conditional unallocated debit and pending reserve together with the withdrawal insert; one transaction either commits all operations or none. Competing balance updates return retryable 409 (the UI keeps its original request key for safe retry).

## Allocated + unallocated withdrawal reservations (updated model)
- **Authoritative requestable balance:** `allocatedUsdcMicros + unallocatedUsdcMicros - pendingWithdrawalsUsdcMicros`. The UI shows all four values, and the backend recomputes the same expression inside a Serializable transaction. Multiple concurrent requests are supported while the formula remains sufficient.
- On request: **do not change allocated or unallocated balances**. Increment `pendingWithdrawalsUsdcMicros` by the gross request amount, insert the idempotent PENDING withdrawal, and create a linked `WithdrawalDeallocation` if pending claims exceed the current unallocated balance. The new deallocation obligation is the **incremental shortfall**: `max(0, pendingAfter - unallocated) - max(0, pendingBefore - unallocated)`. This avoids double-booking allocated capital across several requests.
- On a **verified payout success webhook only**: decrement pending gross and debit gross from unallocated first, then allocated for any remaining amount. On verified payout failure or allowed user cancellation: decrement pending only; allocated and unallocated remain unchanged.
- The `WithdrawalDeallocation` table contains withdrawalId, userId, portfolioId, USDC micros, status and timestamps. A second scheduled endpoint, `/api/internal/process-deallocations`, calculates count and total of pending deallocations every minute, **without calling Kalshi or marking transfers completed**.
- Payout cron explicitly excludes requests with PENDING/PROCESSING/FAILED deallocation obligations. Such withdrawals cannot be broadcast until a future audited Kalshi integration verifies return of funds and marks their deallocation COMPLETED; an authenticated reconciler must also adjust actual master-wallet liquidity.
- Future master-to-Kalshi auto-allocation after a sweep is deliberately **not implemented**.
- **Important limitation for later work:** cancellation and out-of-order payout settlement can change the ideal distribution of unallocated/allocated coverage across still-pending withdrawals. Before activating a Kalshi deallocation integration, implement locked recalculation/reconciliation of outstanding deallocation obligations (rather than blindly trusting stale individual shortfall rows). Also ensure allocation/trading operations respect withdrawal reservations.
- This change supersedes the older sections of this document that described immediate unallocated debits on withdrawal request.
