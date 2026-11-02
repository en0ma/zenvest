# Zenvest — living handoff

Updated: 2026-11-02.

New admin RBAC workstream: feature/admin-rbac-financial-approvals, branched from main. Independent staff role/permission grants; deny by default; enforce admin 2FA; audit all financial mutations; use maker-checker workflows for high-risk actions. Never call raw balance or custody APIs from an approval endpoint.

Current PR is a draft. No production-ready financial execution is authorized until domain-level invariants, idempotency, tests, and double approval are implemented.

Every future commit must update this document. Do not merge or touch main without approval.
