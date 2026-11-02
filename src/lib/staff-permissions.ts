export const STAFF_PERMISSIONS = ["users:read","users:write","deposits:read","deposits:reconcile","withdrawals:read","withdrawals:approve","balances:read","balances:adjust","wallets:read","wallets:operate","roles:read","roles:manage","audit:read"] as const;
export type StaffPermissionKey = typeof STAFF_PERMISSIONS[number];
export const APPROVAL_REQUIRED = ["users:write","deposits:reconcile","withdrawals:approve","balances:adjust","wallets:operate"] as const;
export const DEFAULT_ROLE_GRANTS = {
 auditor:["users:read","deposits:read","withdrawals:read","balances:read","wallets:read","roles:read","audit:read"],
 support:["users:read","deposits:read","withdrawals:read","balances:read","wallets:read"],
 operations:["users:read","users:write","deposits:read","deposits:reconcile","withdrawals:read","withdrawals:approve","wallets:read","wallets:operate"],
 finance:["deposits:read","deposits:reconcile","withdrawals:read","withdrawals:approve","balances:read","balances:adjust","audit:read"],
 "super-admin":STAFF_PERMISSIONS
} as const;
