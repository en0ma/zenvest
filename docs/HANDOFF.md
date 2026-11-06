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

2026-11-04: Updated role lifecycle tests to account for mandatory baseline user membership: explicitly select assigned staff role and verify staff revocation retains exactly the baseline user role. CI first failure was this old assumption, not a production error.

2026-11-04: Removed manual balances:adjust capability, role grants, approval flow, proposal UI and validator, and purged old permission grants in additive SQL migration and role-seed. Balances remain read-only; only independently verified financial events may mutate funds. Updated tests to assert adjustment requests are prohibited.

2026-11-04: Fixed recurring seeded strategy-design account to rely on auto-assigned baseline user RBAC membership rather than removed Prisma User.role. Prior GitHub Actions completed coverage but failed post-test fixture seed because it still provided the legacy role argument.

2026-11-04: Updated RBAC policy tests to enforce that manual balances:adjust does not exist as a grant or approved action target. This was an expected policy change, not weakening a security test.

2026-11-04: Fixed resource preview /admin/[resource] to read roles from unified Prisma Role model rather than removed staffRole model; detected in Vercel typecheck logs.

2026-11-04: Fixed JSX/TS syntax found in preview build after removing manual balance adjustment form, keeping amount validation only for wallet transfers.

2026-11-04: Final RBAC table migration (draft branch only): drops obsolete users.role and PostgreSQL Role enum, then renames existing StaffRole, StaffPermission, StaffRolePermission, StaffRoleMembership to Role, Permission, RolePermission, UserRole without dropping grants or memberships; Prisma models now use exact table names. Rebinds baseline user creation trigger, and protects baseline user role from deletion or reassignment. Must confirm full CI/preview before any merge.

2026-11-04: Updated disposable CI fixture teardown to remove only temporary staff roles, never mandatory user baseline membership; user deletion cleans up baseline via user FK cascade. Database now prevents manual baseline revocation.

2026-11-04: Added PostgreSQL integration test for unified RBAC: legacy users.role absence, four unified table names, automatic baseline on user creation, correct inherited user capabilities and no admin grants, additive staff role, non-revocable baseline, FK to real user and cascading cleanup on account removal. Wired into coverage CI.

2026-11-04: Fixed role test teardown to restrict temporary keys rather than reference a try-block local from finally.

2026-11-04: Investor access now also checks effective role-based permissions (not just presence of baseline role): the permission union across memberships is evaluated server-side, and key own-account routes require allocations:create:own, withdrawals:create:own, deposits:create:own, portfolio:read:own. Existing owner-specific query filters remain unchanged.

2026-11-04: Fixed remaining TS test reference to removed balances:adjust FinancialOperation. All policy tests and builds must pass before merge.

2026-11-04: Preserved existing plain requireUser() authentication contract on investor money routes and added a separate requireInvestorPermission(userId,permission) RBAC grant check for allocations, withdrawals and wallet activation. The original security contract test remains unchanged and the new checks add a second guard.

2026-11-04: Fixed admin landing gate for universal baseline roles: an account with only user permissions is redirected to investor dashboard; the admin shell is shown only when there is at least one granted staff section. Endpoint authorization remains server-side.

2026-11-04: Updated test-only authenticated-route shim to export newly added requireInvestorPermission; production access module remains the true role-backed permission checker. Prior CI failure was the missing mock export.

2026-11-04: Verified GitHub Actions Zenvest CI run #2465 (run 41830207449) completed successfully at head 2a1d550: disposable PostgreSQL migrations, integrated/unit coverage, typecheck, production build, and built HTTP financial endpoint security verification all passed. The 'Apply production database migrations' job was SKIPPED; this does not validate production migration rollout or approve deployment. Keep PR #85 draft and do not merge or enable financial execution flags without separate production migration planning, environment/preview review and authorization. No code or security policy was changed in this verification checkpoint.

2026-11-04: Hardened mandatory unified RBAC baseline identity: added an additive PostgreSQL trigger to block renaming/deleting the `user` Role while leaving other role lifecycle operations unchanged. Added disposable PostgreSQL negative tests that verify baseline identity survives attempted mutation. Prior CI succeeded; new migration/tests require fresh GitHub Actions CI and no production rollout is authorized.

2026-11-04: Added a disposable PostgreSQL *upgrade-path* CI scenario, distinct from fresh-database migration tests. CI applies migrations only through the legacy StaffRole/StaffPermission schema, inserts an existing legacy user and staff role/permission/grant/membership with fixed IDs and actor provenance, then applies the baseline and unified RBAC migrations and checks that the staff authorization records are preserved while the user receives the mandatory baseline role. The fixture is explicitly restricted to zenvest_ci and test mode. Must validate this new CI run before claiming upgrade-path coverage; production migration remains disallowed on the draft PR.

2026-11-04: Corrected the upgrade runner's migration-directory regex after its initial commit. The upgrade test must be judged against a CI run of the corrected head, not the earlier run. No production database operations were performed.

2026-11-04: CI #2470 exposed a test fixture insert omission (the historical users.updated_at NOT NULL field). Corrected the *disposable upgrade fixture* raw SQL to set updated_at= CURRENT_TIMESTAMP. The prior test aborted before cutover; this is not evidence of an RBAC migration failure. Rerun full CI against the amended commit before accepting upgrade-path verification.

2026-11-04: Confirmed GitHub Actions CI #2471 succeeded at 0194c41, including real disposable PostgreSQL upgrade-path preservation checks, tests/coverage, typecheck, build and built HTTP financial endpoint tests. Production migration job remained skipped. Expanded upgrade fixture to include an account with the old ADMIN enum and assert it receives only the mandatory baseline user role and no implicit staff privileges; explicit staff memberships continue to be preserved. This additional regression needs its own green CI before sign-off; controlled Super Admin bootstrap and production rollout remain separate authorization gates.

2026-11-05: GitHub Actions CI #2472 PASSED at 40f48c1, including a legacy ADMIN account regression that proves historical users.role='ADMIN' does not automatically grant staff permissions, plus preservation of explicit old staff memberships. Added read-only legacy RBAC preflight designed to detect orphan staff memberships, any privileged grants on a preexisting 'user' role, and migration seed ID conflicts before cutover. CI upgrade fixture now tests that a deliberately unsafe user-role grant causes preflight rejection, then clears it and verifies a clean preflight before applying migrations. This new preflight and negative-test change requires its own successful CI. Production rollout remains blocked; no production migrations or Super Admin bootstrap were run.

2026-11-05: Verified GitHub Actions CI #2473 succeeded at d5e45b6, including read-only RBAC preflight, unsafe-baseline-grant negative test, migrations, integration/unit coverage, typecheck, build and HTTP financial security verification. Added docs/SUPER_ADMIN_BOOTSTRAP.md as an operator-controlled, out-of-band *planning runbook* detailing two-person approvals, staging rehearsal, account/2FA validation, transactional membership-and-audit provisioning, session invalidation and rollback. No executable bootstrap, Super Admin grant, production migration or main-branch change was performed. Production rollout stays blocked pending explicit authorization and security review.

2026-11-05: Product owner explicitly removed controlled Super Admin bootstrap from PR #85's development scope: they will assign the super-admin role to their own account through direct database access. Deleted docs/SUPER_ADMIN_BOOTSTRAP.md as no longer required; its prior handoff entry is historical and superseded by this decision. No bootstrap API, automatic provisioning, role assignment, SQL execution, or production database change is requested or performed. Preserve 2FA, live server-side role/permission checks, restricted public role management and the requirement that database edits remain properly auditable. Continue with financial controls and migration release-readiness review; do not merge or deploy without approval.

2026-11-06: Owner explicitly forbade administrators from dispatching investor withdrawals or reconciling/replaying investor deposits. Removed both admin API endpoints, UI controls, proposal/review options, privileges from role definitions and seed script, and dedicated policies/tests. A new additive PostgreSQL migration deletes these two permission keys and their grants; a NOT VALID check rejects newly created/updated forbidden StaffAction records while retaining historical records for audit. Added route, RBAC and database denial regressions. The existing investor-facing Blockradar deposits and withdrawals and distinct platform treasury / mocked Kalshi operations remain untouched. Neither STAFF_WITHDRAWAL_EXECUTION_ENABLED nor STAFF_DEPOSIT_RECONCILIATION_ENABLED was present in inspected Vercel Production/Preview settings; do not create them. New CI required; PR remains draft and production migrations prohibited without explicit approval.

2026-11-06: User requested no required transfer-size cap for independently approved MASTER_TO_WALLET and mocked KALSHI_TO_MASTER actions, and required Super Admin to be the default **independent reviewer** of every admin proposal, with only Super Admin able to enable or disable additional reviewer roles through the admin UI. Changed wallet payload validation so STAFF_WALLET_TRANSFER_LIMIT_MICROS is optional (invalid values still fail closed; amount parsing, treasury availability, custody protection and maker-checker stay mandatory). Added singleton StaffApprovalPolicy table defaulting to no additional reviewers; Super Admin membership always qualifies, while authorized Super Admins may allow operations/finance/support/auditor to review through a 2FA/fresh-login-protected, audited API and staff role settings UI. Review rights are separate from the requester's operation permissions; the review endpoint rechecks live reviewer membership/policy inside a serializable transaction and prohibits self-approval. Existing financial execution paths and investor-funds admin prohibitions unchanged. This commit requires fresh CI; no production migration, merge or flags changed.

2026-11-06: CI #2477 passed Prisma schema validation and legacy database upgrade path but failed the combined suite because the newly added approval-policy route test omitted its GET/PUT import (ReferenceError: getReviewPolicy is not defined). Fixed the *test import* without changing authorization or financial behavior. Full fresh CI required before review. Production migrations remain skipped.

2026-11-06: Made the admin landing page show the review queue to staff roles explicitly permitted by the Super Admin-controlled reviewer policy, even when those roles do not separately hold audit:read. The underlying review API still enforces verified 2FA, current membership, live policy and independent approval. No extra audit or transfer permission is granted. This follow-up navigation change needs its own CI.

2026-11-06: Explicitly removed the previously optional STAFF_WALLET_TRANSFER_LIMIT_MICROS mechanism in its entirety from current code: wallet validation and its function signature, action proposal/review and execution routes, test setup/cleanup and tests. Historical handoff mentions are superseded by this entry. Exact USDC integer micros, destination fields, platform/Kalshi treasury availability, custody protections, independent maker-checker and role-based authorization still apply; no configurable amount cap exists. Previously checked Vercel did not contain that variable. New CI is required; PR stays draft, unmerged, with no production migration or deployment.

2026-11-06: Owner clarified Super Admin does NOT require a second reviewer, overriding prior blanket maker-checker requirement for that role only. A freshly authenticated, 2FA-verified user with the actual `super-admin` membership now creates an already-APPROVED and explicitly audited StaffAction; the transfer still needs a separate manual execution step. Existing pending Super Admin requests may be self-decided. All non-Super Admin staff still require an independent eligible reviewer, according to the Super Admin-configurable reviewer role policy. Platform master-wallet payout and mocked Kalshi return execution now allow self-approved actions only if the requester's canonical Super Admin membership is revalidated inside the serializable execution transaction; a revoked Super Admin cannot execute a previously self-approved action. Other custody, source-of-funds, signed settlement, idempotency and investor-funds admin prohibitions stay in place. Added unit/API/real-disposable-PostgreSQL tests for both permitted and forbidden self-approval. Also corrected the stale two-argument wallet validator calls revealed by CI #2480 (that prior commit's typecheck failed). This commit still requires fresh complete CI; no production database, main branch or deployment changes.

2026-11-06: Owner requested UI-based role creation and editing (add/remove role permissions). Added Super Admin-only role catalog/create/replace API and staff role editor UI showing current memberships, allowed permissions and current grants. The mandatory baseline user and super-admin roles are immutable in the API and interface; only current supported staff permissions may be granted, and roles:manage, retired investor-funds admin privileges, and baseline investor grants are excluded. Role permission replacements are transactional, audited and invalidate affected member sessions; staff access continues to resolve live DB grants. Newly created roles are assignable/revocable through existing UI with live Super Admin membership enforced inside each transaction; no account can grant itself a role or assign the super-admin role. Super Admin reviewer-role settings now accept existing custom roles, with a new migration updating the previous hardcoded DB whitelist. Re-running the RBAC seeder does not restore deleted permissions to preexisting editable roles. Tests cover policy and API denials, role lifecycle, approval-setting custom roles, and actions. No production migration, merge, or deployment performed; fresh CI required.

2026-11-06: Added human-readable Permission.description (non-null TEXT, default empty for unknown/historical rows) with a migration populating all 16 known permission keys. Updated the RBAC seed to upsert canonical descriptions without changing previously customized role grants. Super Admin role editor now reads descriptions from the Permission database table and displays each next to its permission key. The role catalog API also returns these descriptions. Added catalog consistency tests. No permissions, roles, grants, or authorization rules changed. The migration runs in disposable CI only; do not merge or migrate production without explicit approval.

2026-11-06: Follow-up to Permission.description migration: CI #2483 completed schema/migration checks but its combined test failed because an integration assertion incorrectly expected all four sampled permission keys to exist in the disposable CI fixture. Fixed the assertion to verify the new SQL column exists and that present permissions expose a description; the disposable fixture intentionally does not seed the full permission catalog. Full CI must pass on this follow-up.

2026-11-06: Login 2FA UX fix (new review PR): when both email code and authenticator are enabled, login now shows only the saved default method. Removed verification-method toggle buttons and the ability to override the method in the login challenge API; the backend validates the persisted default and fails closed if its factor is unavailable. Recovery-code verification and settings-side method management remain unchanged. Added regression tests for APP default, EMAIL default, and invalid/missing default. No migration, merge, or deployment in this commit.

2026-11-06: Expanded draft PR #86 with staff login 2FA enrollment. Admin role assignment now allows active email-verified users who have not enabled 2FA; it also bumps the member's session version to invalidate existing investor sessions. Login start identifies live non-baseline Role memberships and routes unenrolled staff to a password-verified pre-session enrollment flow (authenticator app or email code, server-side verification, one-time recovery codes). Direct NextAuth credentials login explicitly denies unenrolled staff, regardless of client-side route choice, while normal investors keep optional settings-based 2FA. The enrollment endpoint rechecks live staff membership, verified credentials, and challenge attempts, expiry and consumption. Added staff 2FA policy tests and a built HTTP regression confirming that unenrolled staff cannot obtain a session. Preserve investor authentication behavior; no DB migration, deployment or merge on this branch.

2026-11-06: Follow-up to staff enrollment PR #86: CI #2487 caught an invalid nested Prisma select expression in two new login membership reads before typechecking. Replaced those reads with valid include:{role:true} queries; continue validating the staff enrollment test suite and built HTTP login tests. No merge or deployment.

2026-11-06: Staff enrollment test follow-up: CI #2488 failed because legacy tests expected login method switching to EMAIL even when APP was configured as default. Updated that check to require APP and added disposable PostgreSQL security tests for staff signup gating, password rejection, enforced enrollment, app and email verification, recovery code generation, replay rejection, and required reenrollment after 2FA removal. Cleared historical fixture challenges between test phases to keep rate-limit tests independent. New CI pending; no merge or deployment.

2026-11-06: Simplified draft PR #86 at user request: removed the pre-session staff 2FA enrollment experience, staff-enrollment API, policy helper, associated tests, and forced-enrollment checks. Restored the existing administrative rule requiring verified 2FA before staff role assignment. Investor 2FA enrollment stays optional in Settings. Retained only the login default-method fix (no EMAIL/APP login selector; the login challenge always uses the persisted default), with a legacy regression expectation updated to verify that alternate-method requests cannot override the default. Previous descriptions of staff login enrollment above are superseded by this entry. No migration, merge, or deploy.

2026-11-06: Stage 1 investor treasury consolidation (draft PR, not deployed). DEPOSIT is the only active master-custody investor principal balance bucket; ALLOCATE tracks investor funds at Kalshi. Verified allocation still debits DEPOSIT on signed outbound Blockradar success and credits ALLOCATE following independently authenticated Kalshi receipt plus P&L-safe position application. Verified deallocation now debits ALLOCATE and credits DEPOSIT in one serializable transaction with investor unallocated credit, with provider and position checks intact. Investor withdrawal debits DEPOSIT only using a conditional sufficient-balance check, preserving fees and replay-safe settlement. The investment/withdrawal/platform preflight custody checks no longer sum a separate DEALLOCATE bucket. CI fixtures and withdrawal rollback tests no longer require it. Historical DEALLOCATE strategy events and treasury transfer directions remain. The legacy Prisma/PostgreSQL TreasuryKind.DEALLOCATE enum member is intentionally unused and retained to avoid schema migration; user stated the database has no existing live data, so no data-conversion migration is included. Global outbound custody reservations and ambiguous payout REVIEW timeout remain known Stage 2 issues; do not interpret this PR as full financial production readiness.

2026-11-06: Added PostgreSQL-backed return settlement integration test (scripts/check-direct-treasury-return.mjs) to the coverage suite: rejects mismatched custody receipt, ensures ALLOCATE debit equals DEPOSIT credit and investor credit, asserts no DEALLOCATE balance row is created, preserves DEALLOCATE transfer direction, and verifies duplicate/mismatched replay cannot alter balances. Uses disposable CI fixtures and restores all treasury values. No migration or production changes.

2026-11-06: Stage 1 CI follow-up: the database integration suite now expects six active treasury rows rather than seven and explicitly checks conservation (DEPOSIT + returned amount, ALLOCATE - returned amount), absence of a DEALLOCATE balance row, and duplicate return safety. CI #2492 exposed the outdated fixture count; added assertions in scripts/check-ci-db.mjs. No migration or production operations.

2026-11-06: Corrected CI integration harness extension matching: avoid rewriting ./db.ts to ./db.ts.ts in the new verified-return test module resolver (CI #2494 detected this harness-only import bug). No production logic changes, no migration or deployment.

2026-11-06: Extended draft PR #87 with explicit staff treasury transaction directions: K_BANK_DEPOSIT (reserved for verified Kalshi platform-profit accrual, not yet implemented), K_BANK_WITHDRAWAL (verified Kalshi outbound), M_BANK_DEPOSIT (verified master inbound), and M_BANK_WITHDRAWAL (verified staff master payout, potentially sourced from M_BANK and platform fee buckets). The Kalshi return settlement atomically creates matched K_BANK_WITHDRAWAL + M_BANK_DEPOSIT entries along with K_BANK debit and M_BANK credit; provider mock HTTP 200 never creates them. Platform payout webhook writes M_BANK_WITHDRAWAL. Added additive PostgreSQL enum migration for the four names only—no legacy data or treasury balance conversion; the three PLATFORM_* legacy directions remain unused for compatibility. Expanded CI assertions for paired ledger idempotence and new enum values. No live deployment, merge, or unverified provider balance writes.

2026-11-06: Added disposable CI database test scripts/check-platform-profit-pnl.mjs: two snapshotted investor positions, verified settled profitable trade with aggregate platform fee, K_BANK_DEPOSIT journal + K_BANK credit exactly once, investor net P&L conservation and duplicate replay, plus loss event posting zero platform fees and no bank credit. Added to the standard combined-coverage suite; no provider activity or production financial writes.

2026-11-06: CI #2497 exposed the unique partial index treasury_transactions_allocate_destination_receipt_unique comparing the old TreasuryDirection enum during PostgreSQL type replacement. Updated the still-unmerged migration to drop that index immediately before ALTER COLUMN TYPE and recreate the identical unique partial index immediately after, preserving Kalshi receipt uniqueness. No financial data conversion, merge, or production operation.
