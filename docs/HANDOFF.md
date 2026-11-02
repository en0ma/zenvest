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
