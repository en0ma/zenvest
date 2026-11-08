# Stage 2D: read-only treasury and custody audit

This phase detects inconsistencies; it **never** moves assets, changes a treasury
amount, changes a withdrawal status, retries a transfer, or marks anything settled.

## Schedule and authorization

`GET /api/internal/audit-treasury` is scheduled for **04:00 UTC daily** via
`vercel.json`, protected by `Authorization: Bearer <CRON_SECRET>`. It runs
read-only PostgreSQL queries in a repeatable-read snapshot, then fetches the
Blockradar master-wallet USDC balance through the same authenticated wallet
balance API as the withdrawal worker. The Blockradar credentials, master wallet
ID and Solana USDC asset ID must be configured.

The API responds with JSON containing severity, stable issue code, counts,
up to five example internal identifiers, and expected/observed master USDC
micro-balances. The cron's operational logs emit **only issue codes and counts**,
not wallet addresses, bearer tokens, user identities or provider payloads.
Critical issues and incomplete audits cause HTTP 503 so uptime/log alerting can
detect them; warning-only findings are HTTP 200 with warning logs. Configure
the deployment log/alert platform to notify operations on
`component=treasury-audit` warnings/errors and non-2xx cron results. This
implementation does **not** provide a separate email/SMS paging service.

## Internal checks

- Exactly six active treasury buckets: `DEPOSIT`, `ALLOCATE`,
  `DEPOSIT_FEE`, `WITHDRAWAL_FEE`, `M_BANK`, `K_BANK`; no dormant
  `DEALLOCATE` balance row, duplicate, missing, negative or misidentified
  custody bucket.
- `COMPLETE` investor withdrawal ledger entries match the linked
  `COMPLETED` withdrawal on amount, fee, direction and unique reference.
- `CONFIRMED` investor deposits link to complete matching `DEPOSIT` ledger
  transactions, using the original Blockradar provider transaction ID as
  the ledger reference.
- Verified `K_BANK_WITHDRAWAL` staff transfers have one matching
  `M_BANK_DEPOSIT` for the **same** provider withdrawal, master receipt and
  amount; this is a two-sided history entry, not two credits.
  The audit detects either side missing, including a master receipt with no
  corresponding Kalshi withdrawal journal.
- Every completed platform-owned master payout must have a completed
  `M_BANK_WITHDRAWAL` ledger entry for its exact amount and destination.
- `K_BANK_DEPOSIT` platform-profit ledger amounts match settled
  participating investor fee shares for the referenced trade. A profitable
  finalized trade missing its `K_BANK_DEPOSIT` journal also raises a finding.
- Negative investor unallocated and position allocated amounts, plus investor
  or staff payout `REVIEW` records older than two hours.
- Records scanned for ledger checks are capped at 2,000 per type; reaching the
  cap produces an `AUDIT_SCAN_LIMIT` finding and marks the audit incomplete.
  The report cannot claim complete historical coverage beyond that bound.

## External master-custody comparison

The expected master-wallet **claims** are:

`DEPOSIT + DEPOSIT_FEE + WITHDRAWAL_FEE + M_BANK + outstanding platform payout reservations`

Outstanding platform payout reservations have already been debited from
platform treasury buckets when the payout was created, but the physical funds
may remain at master custody until authenticated payout completion.

The audit compares this total with authenticated Blockradar **master USDC**
balance. Differences produce `MASTER_CUSTODY_DIFFERENCE` warnings, not
automatic correction. In-flight investor allocations, investor withdrawals,
platform transfers, sweep timing, pending reconciliation and external provider
movements may temporarily affect the comparison. It is an *investigation
signal*, **not proof of loss, theft, or an available spending balance**.

`ALLOCATE` and `K_BANK` are Kalshi-side buckets and are **not** added to
master custody claims. This phase does not independently query Kalshi's actual
custody balance; that source needs a verified integration under Stage 2C/2E.
If Blockradar balance retrieval fails, the audit reports
`MASTER_CUSTODY_LOOKUP_UNAVAILABLE`, marks the run incomplete, and never
interprets unavailable data as a zero balance or definitive discrepancy.

## Safety and boundaries

The audit performs no writes anywhere in the money-moving subsystem.
Use a confirmed provider or blockchain receipt and the established
idempotent settlement workers to resolve legitimate discrepancies.
Investigate `REVIEW` withdrawals using the separately drafted Stage 2A
staff Resolve Review workflow (PR #88); the audit never releases held funds.
Global cross-worker master custody reservations (Stage 2B), full paginated
provider transaction reconciliation (Stage 2C), and real Kalshi withdrawal
transport (Stage 2E) remain separate and are **not** implied complete here.
