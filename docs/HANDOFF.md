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
