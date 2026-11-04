# Zenvest — living handoff

Updated: 2026-11-02.

New admin RBAC workstream: feature/admin-rbac-financial-approvals, branched from main. Independent staff role/permission grants; deny by default; enforce admin 2FA; audit all financial mutations; use maker-checker workflows for high-risk actions. Never call raw balance or custody APIs from an approval endpoint.

Current PR is a draft. No production-ready financial execution is authorized until domain-level invariants, idempotency, tests, and double approval are implemented.

Every future commit must update this document. Do not merge or touch main without approval.

2026-11-02: Added migration for staff permissions, roles, memberships, action proposals and audit records. No financial execution.

2026-11-02: Added audit-tracked, idempotent staff action proposal and independent approval/rejection APIs. These do not execute financial transactions.

2026-11-02: Added first explicit-projection users read endpoint guarded by staff users:read permission.

2026-11-02: Added idempotent role/permission seed and minimal protected /admin shell. Seed does not provision any staff users or confer access.

2026-11-02: Added protected paginated read endpoints for deposits, withdrawals, balances, wallets, audit and roles. Financial amounts serialize as decimal strings.

2026-11-02: Built role-filtered admin navigation and permission-gated read-only tables for users, deposits, withdrawals, balances, wallets, roles and audit. Rows limited to recent 30 and monetary micros serialized as strings. Financial execution remains disabled.

2026-11-02: Added pure permission catalogue tests for uniqueness, valid role grants, enforced approval list, denied high-risk permissions for support/auditor and restricted role management. Integration tests are still needed.

2026-11-02: Adjusted RBAC test typing to explicit string sets for TypeScript strict compatibility.

2026-11-02: Repaired CI-detected admin landing page syntax error; restructured role-grant fetch into separately typed queries. CI rerun required.

2026-11-02: Added restricted staff role assignment API requiring roles:manage. No self-assignment or Super Admin API grants; target must be active, verified and enrolled in 2FA; changes are transactionally audited. Root administrator must be provisioned out of band.

2026-11-02: Added permission-gated read-only action review queue and audit:read GET endpoint. Approval decisions remain API-only; execution disabled.

2026-11-02: CI on e9398fa failed line coverage 84.37% against 85% gate (typecheck and Vercel succeeded). Added isolated financial review policy and unit tests for dual control, permissions, 2FA and allowlisted operations. Full API integration coverage remains outstanding; do not reduce thresholds.

2026-11-02: Wired shared allowlist and maker-checker policy helpers into the action proposal and decision routes; keeps DB conditional state transition, server-side authentication and zero execution boundary.

2026-11-02: Added interactive Approve/Reject controls in admin action queue; client confirms intent, POSTs to server decision endpoint, refreshes results. Controls shown only for pending requests with corresponding permission and another requester. Server remains authority; financial execution remains disabled.

2026-11-02: Added roles:manage-gated revocation for restricted non-super-admin roles. No self-revocation, transactionally audited, and increments target sessionVersion to invalidate existing sessions. Staff role removal requires permission re-evaluation. CI still needs coverage tests.

2026-11-02: Admin action creation checks target existence for user/balance/deposit/withdrawal/wallet resources before queue entry. This is preliminary validation only; execution must still revalidate target state and monetary invariants.

2026-11-02: Added isolated admin route integration harness exercising resource reads, denied access, proposal target verification, maker-checker rejection and audit transitions; integrated into c8 CI runner. The harness uses mocked DB/access to target route behavior, not genuine Postgres/auth integration. CI verification pending.

2026-11-02: Corrected the CI harness request stub to expose NextRequest.nextUrl for paginated admin resource handlers.

2026-11-02: CI admin route harness failed because NextRequest was imported as runtime symbol from next/server; fixed testable route imports to type-only. Coverage numbers from aborted run were not meaningful.

2026-11-02: Fixed CI mock fixture to honor user/action route projections and omit BigInt from routes returning direct Response.json; prior test returned 403 because fixture's JSON serialization failed. Rechecking full coverage gate.

2026-11-02: At commit 04565a8 CI and Vercel both passed. Hardened decision request validation with strict Zod schema to reject unexpected fields, added route regression check. Still no financial execution.

2026-11-02: Added disposable-PostgreSQL staff approval integration checks: persisted role grant resolution, unique idempotency key, competing conditional decisions, exactly-once decision audit, no balance mutation, and repeat-decision refusal. Integrated into CI coverage runner. This is a DB-level test, not yet a complete live-session HTTP authorization test.

2026-11-02: Limited approval/rejection to requests created within the last 24 hours, with fail-closed clock validation and unit tests. UI disables aged requests; API remains authoritative. Pending old actions require a fresh separately reviewed proposal. No financial execution enabled.

2026-11-02: Made approval timestamp mandatory in shared review policy, and updated unit and route fixtures to exercise the expiry gate. No missing-timestamp bypass.

2026-11-02: Aligned users:write with mandatory maker-checker permission catalog and test. Decision compare-and-swap now checks pending status, live timestamp window and non-requester in the same database transaction, guarding time-of-check/time-of-use races. Financial execution remains disabled.

2026-11-02: Added role-filtered admin action proposal form. Requires exact target ID and reason; uses per-submission idempotency key and explicitly discloses non-execution; existing server-side authorization and validation remain authoritative. No amount/payload or custody execution added.

2026-11-02: Added permission-protected staff role management UI (assign/revoke restricted roles with confirmation, feedback and session invalidation on revoke), plus admin navigation links for review queue and role manager. Super Admin cannot be granted by this UI. End-to-end role-management tests and bootstrap remain outstanding.

2026-11-02: High-risk approval/rejection and staff role assignment/revocation now require login within past 15 minutes (including sign-in 2FA), based on server-verified securitySession.createdAt relayed through NextAuth JWT/session, not client input. Missing/future/expired timestamp fails closed. UI should prompt re-login; full step-up per action remains outstanding. No financial execution.

2026-11-02: Extracted 15-minute staff login age validation into a pure helper, with boundary and fail-closed unit tests. Sensitive API routes still require live session, permissions and verified factor.

2026-11-02: Sensitive admin writes now return a distinct 401 STAFF_REAUTH_REQUIRED response when the server-verified login exceeds 15 minutes. Approval and role UI show a sign-in link for that code; all other errors remain generic and fail closed. No financial execution enabled.

2026-11-02: Added tests for 401 reauthentication response and non-disclosure of unexpected errors; verify through CI.

2026-11-02: Added explicit fail-closed financial execution guard and tests for all four money/custody operation classes. Guard never authorizes execution even for independently approved requests. This is a safety contract only; production financial adapters, ledger accounting, and limits remain unimplemented.

2026-11-02: Expanded mocked-route CI coverage to role assignment and revocation: denied self-management, rejected super-admin changes, strict body schemas, restricted role creation, audited revocation/session-version bump and unauthorized requests. PostgreSQL-backed role lifecycle tests still required.

2026-11-02: Added actual disposable PostgreSQL role lifecycle tests (membership creation, duplicate uniqueness, grant resolution, revocation, sessionVersion increment and two audit records); wired into CI coverage runner. No financial execution.

2026-11-02: Require fresh verified admin login before creating sensitive user/financial action proposals, matching the existing reviewer freshness requirement. Reuse server-validated 15-minute session gate. No execution enabled.

2026-11-02: Sensitive action proposal route now returns the standard 401 STAFF_REAUTH_REQUIRED response when login is stale, matching the role and approval APIs.

2026-11-02: Proposal form now displays a reauthentication link when the backend rejects a stale login. This matches approval and role-management UI behavior.

2026-11-02: Added validated, typed balance-adjustment proposal payloads with strict USDC micro integer parsing and deny-by-default configured maximum STAFF_BALANCE_ADJUSTMENT_LIMIT_MICROS; no float, extra fields, or amount above max allowed. Non-balance operations reject arbitrary payload injection. No ledger or custody execution enabled; amount limits are provisional proposal controls only.

2026-11-02: Proposal UI now collects explicit credit/debit and positive integer USDC micros for balance-adjustment review; API is still authoritative on configured maximum. Other operations submit only empty payload. No actual financial adjustment execution.

2026-11-02: Approval queue displays immutable proposal parameters before review, and decision endpoint revalidates typed payload and the current configured balance-adjustment cap before marking approved. Policy changes can block stale/over-limit requests; execution remains disabled.

2026-11-02: Restricted existing Blockradar withdrawal worker to an optional exact withdrawal ID for staff-directed dispatch (rather than processing the oldest unrelated request). Explicit withdraw-only dispatch opt-in accepted by financial guard only for already approved independent actions; all other operations remain disabled. Existing provider preflight, balance reservations and signed-webhook settlement unchanged.

2026-11-02: Added tightly permissioned POST /api/admin/actions/[id]/execute for only already independently approved user withdrawals; requires fresh login, STAFF_WITHDRAWAL_EXECUTION_ENABLED=true, atomic one-time approval consumption and audit, and delegates to existing targeted Blockradar payout worker. API never settles ledger or declares chain completion; signed webhook remains sole ledger settlement. Unknown provider outcomes never retry automatically. Remaining production deployment and failure-injection verification required.

2026-11-02: Added explicitly confirmed admin withdrawal dispatch control for already-approved withdrawal actions. Requires permission server-side, shows unknown-result no-retry warning, and blocks when execution flag is off; provider acceptance is not treated as settlement.

2026-11-02: Extended real PostgreSQL + mocked Blockradar withdrawal-worker test to prove staff-directed payout targets only the specified withdrawal, skips an older unrelated request and never resends a processed target.

2026-11-02: Fixed admin withdrawal dispatch retry hazard. An already-claimed or missing target is now held for manual review, never rearmed for a second provider submission. Only an independently verified still-PENDING, unsubmitted target can rearm after a definitively preflight-only failure. No bypass of signed-webhook settlement.

2026-11-02: Added classified dispatch-outcome policy and regression tests covering concurrent claim, missing target, unknown outcome, pre-provider failure and provider acceptance. The admin route uses the same fail-closed classification.

2026-11-02: Added targeted independently approved admin deposit reconciliation with exact provider transaction webhook replay, atomic approval consumption, active master wallet verification and signed-webhook-only settlement. Disabled by default behind STAFF_DEPOSIT_RECONCILIATION_ENABLED.

2026-11-02: Added review-queue button for approved per-deposit Blockradar signed-webhook replay; explicit user confirmation, fresh-session recovery link and no direct balance minting. Server execution flag remains off by default.

2026-11-02: Extracted deposit replay eligibility gate and added negative tests for self-approval, mismatched master custody, credited deposits, inactive wallets and unrelated operations. Webhook replay never mutates ledger directly.

2026-11-02: Fixed strict TypeScript nullable checker ID in serializable deposit approval claim, using independently validated non-null approver; prompted by failed CI build. No runtime authorization relaxation.

2026-11-02: Added automated route-level tests for targeted Blockradar deposit replay, strict permission/fresh-login gate, self-approval denial, credited deposit denial, custody master mismatch, exact provider URL, one-shot approval consumption and no-retry ambiguous provider errors; wired into CI.

2026-11-03: User fixed admin wallet funding rules: MASTER_TO_WALLET may debit only M_BANK, DEPOSIT_FEE and WITHDRAWAL_FEE; KALSHI_TO_MASTER may debit only K_BANK and credit M_BANK only after verified confirmation. Added pure fail-closed wallet amount/address/limit validation and treasury funding planner excluding investor DEPOSIT/DEALLOCATE/ALLOCATE and keeping K_BANK separate. Execution remains off pending settlement integration.

2026-11-03: Admin wallet proposals now carry strictly validated kind+amount (and destination only for MASTER_TO_WALLET), require a configured server-side maximum at both proposal and approval, and bind target IDs to the real master DEPOSIT treasury or a strategy with a Kalshi address. No wallet execution API enabled.

2026-11-03: Proposal form now offers precisely two wallet actions: master-to-external (M_BANK+DEPOSIT_FEE+WITHDRAWAL_FEE source only) and Kalshi-to-master (K_BANK source, M_BANK destination); inputs include exact target, amount, destination when applicable and reason. The form does not move funds.

2026-11-03: Added treasury-source and wallet-payload unit tests: master bank/fees only, no K_BANK leakage to master payouts, K_BANK-only Kalshi returns, reservations, negative balances, exact fields, valid Solana destination and configured maximum. Fund-moving execution still disabled for new wallet operations.

2026-11-03: Fixed CI's native Node TypeScript module resolution for the staff wallet policy import (explicit .ts extension). Accounting policy remains master spend M_BANK+DEPOSIT_FEE+WITHDRAWAL_FEE only; Kalshi return K_BANK to configured master and M_BANK after independently verified settlement. Treasury schema classifications alone do not establish legal ownership. Wallet transfer execution remains disabled pending domain/provider integration.

2026-11-03: Added fail-closed resolver and tests proving Kalshi return destination is read only from the configured, Solana-USDC master custody record; invalid/mismatched master data is rejected and browser cannot supply an alternative destination, source bucket or accounting override. Execution stays disabled until Kalshi provider and settlement path implemented.

2026-11-03: Confirmed admin MASTER_TO_WALLET reuses Blockradar withdrawal HTTP transport and signed webhook lifecycle, with separate platform-only treasury accounting. Introduced shared provider transport and distinct platform_withdrawal reference namespace, preserving existing investor wrapper. No platform settlement webhook routing or live execution has been enabled: never debit investor balances for platform transfers.

2026-11-03: Repaired shared Blockradar transport regression found by CI: existing investor withdrawal reference IDs of fewer than 8 characters are permitted as before, while new platform references require >=8 characters. Investor API compatibility preserved.

2026-11-03: Added dedicated PlatformWithdrawal table/status and PostgreSQL constraints: exact positive platform treasury reservations from M_BANK, DEPOSIT_FEE and WITHDRAWAL_FEE, unique staff approval and provider receipt, durable status. Never mix platform payouts with investor Withdrawal rows or debit user balances. No live execution enabled yet.

2026-11-03: Added feature-flag-disabled admin platform withdrawal reservation endpoint: fresh role-based auth and independent approved action, strictly validated MASTER_TO_WALLET payload and master custody identity, SERIALIZABLE one-time action consumption, conditional deductions of only M_BANK/DEPOSIT_FEE/WITHDRAWAL_FEE and durable PENDING PlatformWithdrawal with exact bucket provenance. Does NOT submit a Blockradar request or touch user balances.

2026-11-03: Added authenticated, disabled-by-default targeted platform payout dispatcher and worker using existing Blockradar withdraw HTTP wrapper. PENDING->SUBMITTING CAS, verified master custody must cover DEPOSIT+DEALLOCATE investor liabilities plus ALL pending platform payouts, unique provider reference, asynchronous PROCESSING, ambiguous response REVIEW without automatic resubmission. Pre-provider preflight can safely reset to PENDING. Signed webhook settlement is still being implemented; do not enable deployment flag.

2026-11-03: Routed HMAC-verified platform_withdrawal callbacks to separate transactional ledger settlement; checks master wallet, USDC mint, network, exact amount/recipient/provider receipt, and verified success status. Duplicate callbacks use CAS; successful settlement writes a PLATFORM_M_BANK treasury transaction without touching investor balances or double-debiting reserved buckets. Authenticated provider failures/cancellations restore exact reserved source buckets atomically. Ambiguous provider response stays REVIEW. Late success after FAILED is rejected for investigation.

2026-11-03: Added disposable-PostgreSQL and mocked-Blockradar platform withdrawal integration: atomic reservation, one approval claim, shared withdraw API, verified webhook HMAC, wrong destination/signature denial, exactly-once settlement, provider failure reservation refund, unknown response REVIEW/no retry and no investor balance changes. Wired into CI coverage runner. Feature flag remains off by default until tests pass and deployment review.

2026-11-03: Fixed CI platform reference regression by restricting generic platform transfer calls to platform_withdrawal: references; only the legacy investor adapter may submit withdrawal: references. CI must pass before enabling any payout flags.

2026-11-03: Added separate confirmation controls in approval queue for approved MASTER_TO_WALLET admin actions: reserve only allowed platform treasury first; subsequently dispatch the durable pending platform withdrawal with a distinct confirmation. Displays non-pending status without retry. Server enforces fresh login/permissions/flags; no generic K_BANK payout button.

2026-11-03: User deferred live Kalshi integration and instructed admin K_BANK to M_BANK requests to use existing submitMockKalshiWithdrawal simulation, exactly as investor deallocation currently does. Added a distinct StaffKalshiReturnSimulation record (unique staff action, strategy, fixed master destination, MOCK_ACCEPTED/SIMULATION_REVIEW) to track simulations without ledger or custody mutations; no real K_BANK->M_BANK postings are authorized by mock HTTP 200.

2026-11-03: Added a fresh-login and maker-checker guarded KALSHI_TO_MASTER simulation-only action route. It validates configured master destination, strategy Kalshi address, K_BANK availability, max transfer amount and existing independent approval. Atomically consumes approval + creates a durable simulation claim; calls existing submitMockKalshiWithdrawal and stores MOCK_ACCEPTED or SIMULATION_REVIEW. Never changes K_BANK, M_BANK, investor balances or custody. STAFF_KALSHI_SIMULATION_ENABLED off by default.

2026-11-03: Added explicit Simulate Kalshi return button only for approved KALSHI_TO_MASTER wallet actions. Separate confirmation states no real USDC will move and neither K_BANK nor M_BANK will change. Server requires fresh authorized session, maker-checker approval and simulation feature flag; no live Kalshi service touched.

2026-11-03: Wired disposable PostgreSQL admin Kalshi mock integration into coverage CI: deny disabled/self-approved/over-K_BANK/override-destination actions; one-shot simulate with exact existing investor mock ID, configured master destination, no treasury ledger or user mutations. This is a simulation, not confirmed custody movement.

2026-11-03: Strengthened Kalshi simulation PostgreSQL test to compare M_BANK against its original value rather than a tautology; explicit no-credit assertion protects the mock-only boundary.

2026-11-03: Fixed first CI-detected syntax error in admin Kalshi simulation PostgreSQL test query. Full CI rerun required before claiming validation success.

2026-11-03: Corrected admin KALSHI_TO_MASTER UX to a normal 'Withdraw from Kalshi' action, as with investor deallocation. Uses the same currently mocked Kalshi withdrawal adapter (HTTP 200) but records SUBMITTING -> PROCESSING, not a separate user-facing Simulation action; no confirmed custody or K_BANK/M_BANK settlement on acceptance. Renamed typed Prisma model to StaffKalshiWithdrawal (existing database table mapped for additive migration compatibility), uses providerWithdrawalId and migration for PROCESSING/REVIEW states; changed flag to STAFF_KALSHI_WITHDRAWALS_ENABLED and route to kalshi-withdrawal. The mock remains a provider implementation detail; real adapter deferred.

2026-11-03: Follow-up: prevent multiple pending admin K_BANK withdrawals exceeding total platform K_BANK by holding the sum of SUBMITTING/PROCESSING/REVIEW requests, as mock HTTP 200 never consumes actual treasury funds. Fixed CI test access shim reference, and review queue now displays Kalshi withdrawal PROCESSING/REVIEW status after approved action is consumed. No user-visible simulation action.

2026-11-03: Added verified two-phase admin Kalshi withdrawal settlement fields: sourceConfirmed, destinationConfirmed, globally unique masterReceiptId and treasuryTransactionId. DB checks COMPLETED requires both independent confirmations and ledger link; processing/mock HTTP 200 alone cannot release funds. Preparing reuse of investor Kalshi confirmation and signed Blockradar strategy sweep for K_BANK -> M_BANK only.

2026-11-03: Added independent domain-only staff Kalshi source confirmation and transactional settlement, mirroring investor deallocation proof gates. MOCK HTTP 200 cannot confirm source; verified Kalshi identity and signed master sweep are required before COMPLETE PLATFORM_K_BANK treasury transaction, atomic K_BANK debit and M_BANK credit. No investor records are touched.

2026-11-03: Extended the EXISTING HMAC-verified Blockradar strategy deposit.swept.success handler: metadata.staff_kalshi_withdrawal_id identifies independently confirmed admin Kalshi return; verifies registered strategy deposit address, exact amount and master recipient, then invokes separate K_BANK->M_BANK settlement. Investor strategy_event_id remains on existing ALLOCATE/DEALLOCATE path. Missing proof or mock acceptance cannot credit M_BANK.

2026-11-03: Extended disposable-PostgreSQL staff Kalshi withdrawal test through same HMAC-validated Blockradar strategy-sweep handler as investor deallocation. Rejects mock provider ID as source proof, mismatched amounts and invalid signatures; authenticated independent source confirmation advances to CONFIRMING, signed sweep settles exactly once to COMPLETE PLATFORM_K_BANK ledger and atomic K_BANK debit/M_BANK credit. Asserts no investor balance changes and duplicate callback idempotency.

2026-11-03: CI found signed sweep test fixture master wallet address differed from M_BANK custody identity. Corrected disposable test setup to align both and restore M_BANK address; retained fail-closed production validation of M_BANK/master identity. Verification rerun pending.

2026-11-04: Phase 1 unified RBAC: backfilled existing accounts into mandatory logical user role and created investor baseline permissions; database insert trigger assigns baseline to newly inserted accounts; added FK on role membership after fail-closed orphan check. Legacy User.role remains temporarily for compatibility; subsequent commits migrate all code, then remove enum/column.

2026-11-04: Phase 2 unified RBAC Prisma models now Role, Permission, RolePermission, UserRole mapped to existing Staff* storage to retain all staff grants and avoid migration data loss. Next change updates application delegates and removes legacy account role enum.

2026-11-04: Unified Prisma role delegates adopted across staff role assignment/revocation, audit resources and dashboards, seed scripts and disposable PostgreSQL RBAC integration tests. The underlying tables still retain historical Staff* names via @@map for safe additive migration.

2026-11-04: Registration now relies on database auto-assigned baseline user membership instead of legacy enum. NextAuth validates mandatory user role in DB on every session refresh, no longer exports legacy role claim. Legacy requireAdmin now demands real roles:manage permission. Investor requireUser checks baseline membership. Seeded investor permission keys and CI fixture checks updated. Legacy role SQL removal follows validation.
