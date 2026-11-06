-- Add human-readable permission descriptions without modifying grants.
-- DEFAULT supports existing/custom records, while known permissions receive full descriptions.
ALTER TABLE "Permission" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
UPDATE "Permission" AS p SET "description" = v.description
FROM (VALUES
 ('account:access', 'Access the authenticated Zenvest account.'),
 ('portfolio:read:own', 'View the account holder''s own portfolio.'),
 ('wallet:read:own', 'View the account holder''s own wallet information.'),
 ('deposits:create:own', 'Initiate deposits for the account holder''s own account.'),
 ('withdrawals:create:own', 'Request withdrawals from the account holder''s own available funds.'),
 ('allocations:create:own', 'Create investment allocations for the account holder''s own account.'),
 ('users:read', 'View users and account information in the admin console.'),
 ('users:write', 'Propose supported administrative user changes, subject to approval rules.'),
 ('deposits:read', 'View investor deposit records without manually crediting or reconciling deposits.'),
 ('withdrawals:read', 'View investor withdrawal records without dispatching withdrawals.'),
 ('balances:read', 'View financial balances without editing them.'),
 ('wallets:read', 'View wallet and treasury information.'),
 ('wallets:operate', 'Propose and execute authorized platform-owned wallet operations under applicable controls.'),
 ('roles:read', 'View staff roles and role assignments.'),
 ('roles:manage', 'Manage staff role assignments, roles, and permission grants; restricted to Super Admin.'),
 ('audit:read', 'View staff activity and financial audit records.')
) AS v(key,description)
WHERE p."key" = v.key;
