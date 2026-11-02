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
