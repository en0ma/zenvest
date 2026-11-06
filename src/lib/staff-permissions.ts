export const STAFF_PERMISSIONS = ["account:access","portfolio:read:own","wallet:read:own","deposits:create:own","withdrawals:create:own","allocations:create:own","users:read","users:write","deposits:read","withdrawals:read","balances:read","wallets:read","wallets:operate","roles:read","roles:manage","audit:read"] as const;
/** Canonical descriptions are informational and never grant access. */
export const STAFF_PERMISSION_DESCRIPTIONS:Record<(typeof STAFF_PERMISSIONS)[number],string> = {
 "account:access":"Access the authenticated Zenvest account.",
 "portfolio:read:own":"View the account holder's own portfolio.",
 "wallet:read:own":"View the account holder's own wallet information.",
 "deposits:create:own":"Initiate deposits for the account holder's own account.",
 "withdrawals:create:own":"Request withdrawals from the account holder's own available funds.",
 "allocations:create:own":"Create investment allocations for the account holder's own account.",
 "users:read":"View users and account information in the admin console.",
 "users:write":"Propose supported administrative user changes, subject to approval rules.",
 "deposits:read":"View investor deposit records without manually crediting or reconciling deposits.",
 "withdrawals:read":"View investor withdrawal records without dispatching withdrawals.",
 "balances:read":"View financial balances without editing them.",
 "wallets:read":"View wallet and treasury information.",
 "wallets:operate":"Propose and execute authorized platform-owned wallet operations under applicable controls.",
 "roles:read":"View staff roles and role assignments.",
 "roles:manage":"Manage staff role assignments, roles, and permission grants; restricted to Super Admin.",
 "audit:read":"View staff activity and financial audit records.",
};
export type StaffPermissionKey = typeof STAFF_PERMISSIONS[number];
export const APPROVAL_REQUIRED = ["users:write","wallets:operate"] as const;
export const DEFAULT_ROLE_GRANTS = {
 user:["account:access","portfolio:read:own","wallet:read:own","deposits:create:own","withdrawals:create:own","allocations:create:own"],
 auditor:["users:read","deposits:read","withdrawals:read","balances:read","wallets:read","roles:read","audit:read"],
 support:["users:read","deposits:read","withdrawals:read","balances:read","wallets:read"],
 operations:["users:read","users:write","deposits:read","withdrawals:read","wallets:read","wallets:operate"],
 finance:["deposits:read","withdrawals:read","balances:read","audit:read"],
 "super-admin":STAFF_PERMISSIONS
} as const;
