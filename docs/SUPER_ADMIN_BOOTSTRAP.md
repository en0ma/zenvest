# Controlled Super Admin bootstrap — deployment runbook

**Status: planning only. Not authorization to execute.** PR #85 remains draft. Never perform these steps against production until the RBAC deployment is separately approved, the migration has been backed up and successfully applied, and the operator has verified the target environment.

## Security boundary

- `super-admin` is a *role template*, not an account. The role seed does not grant staff memberships. Old `users.role = ADMIN` is not a substitute and must not be silently elevated.
- Public `/api/admin/roles/assign` and `/api/admin/roles/revoke` intentionally exclude `super-admin`. Do not add it to their allowlists for bootstrap.
- Provision only an **existing named individual account** with active status, verified email and enrolled/verified 2FA; never create shared or break-glass credentials implicitly.
- Require two **independent authorized human approvals** documented in an external change record, one execution operator and a separate reviewer. Strings or environment variables are not evidence of approval.
- Use a narrowly scoped, short-lived database operator credential through an audited change procedure; do not store connection strings, credentials, PII or approval artifacts in Git.

## Release prerequisites (all required)

1. Merge and production deployment remain explicitly prohibited until approved. Check the exact reviewed commit, migration list and deployment environment. Ensure CI and preview checks are green.
2. Take and verify a recoverable backup and rehearse the entire upgrade, bootstrap, validation and rollback plan against a protected copy or staging snapshot with representative existing staff memberships.
3. Run the **read-only** legacy RBAC preflight before the cutover (`node scripts/check-rbac-preflight.mjs`) from an isolated trusted operator environment with correct read-only DB access. It expects *pre-cutover* `Staff*` tables and `users.role` and intentionally rejects already-migrated schemas. A successful preflight is not migration approval.
4. Reconcile any orphan memberships, privilege grants on the baseline `user` role or seed-ID collisions. Do not bypass or weaken the checks. Review legacy `ADMIN` accounts individually; no automatic super-admin promotion is allowed.
5. After independently approved migration execution, verify `prisma migrate status`, mandatory baseline membership for all users, absence of legacy `users.role`, preservation of staff grants and membership identities, role-identity guards, 2FA and route authorization. Ensure application version and schema version are compatible before exposing traffic.
6. Independently confirm the named beneficiary's identity, authorization, active/verified account state, enrolled 2FA, mandatory baseline `user` membership, `super-admin` role template and `roles:manage` grant. Verify no duplicate `super-admin` membership already exists.

## One-time execution protocol (manual, externally approved)

**Do not automate this from CI, a public API, an app startup hook, or a deployment migration.** Two authorized operators must coordinate the exact target account ID and approved change-ticket reference through a protected channel. Do not rely on a preexisting JWT or old admin enum. The executor should:

- Begin a short SERIALIZABLE database transaction and acquire a transaction-scoped advisory lock reserved for the bootstrap procedure.
- Re-read the exact account and its current active/verified and 2FA state **inside that transaction**; verify baseline membership, the canonical `super-admin` role and its `roles:manage` permission. Fail closed on any mismatch.
- Check whether an existing super-admin membership or another bootstrap is already present; avoid accidental privilege expansion. Stop for review rather than assuming repeated execution is safe.
- Insert exactly one `UserRole` membership for the approved account and write an immutable `StaffAudit` record in the **same transaction**. Attribute the action to the actual change operator using the approved audit convention and preserve the external ticket in the external change record; do not place credentials or personal details in audit fields.
- Commit only after a second human has independently validated the target, grant and audit record; otherwise roll back. The handoff does **not** include executable privilege-grant SQL and gives no permission to bypass change control.
- Force the beneficiary to sign in again and complete verified 2FA. Confirm staff access is granted solely by live server-side RBAC and that a baseline-only investor remains excluded from admin navigation and APIs.

## Recovery, revocation and oversight

- A failed or ambiguous transaction must be inspected before retrying. Never blindly rerun privilege-grant statements.
- Undo an erroneous grant through a separately authorized, audited, transactional role-membership removal. Increment the account's `sessionVersion` to invalidate active sessions, as normal staff revocation does; verify permissions are removed and record the outcome. The baseline `user` membership must remain intact.
- Test loss-of-admin-access and recovery in staging before production. If root credentials are compromised, follow incident response; do not use public role APIs or weaken 2FA.
- Schedule a periodic review of all `super-admin` memberships, their 2FA status, audit records and current need. Review financial feature flags and maker-checker independently; admin role alone never constitutes approval to execute a financial transfer.

## Unresolved release decisions

The authoritative operator procedure, independent approvers, protected target selection, migration maintenance window, rollback test evidence and production security sign-off still require explicit human ownership. This document does not assert production readiness, supply approval, or claim that a Super Admin has been provisioned.
