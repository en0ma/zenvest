DELETE FROM "StaffRolePermission" WHERE "permissionId" IN
 (SELECT id FROM "StaffPermission" WHERE key='balances:adjust');
DELETE FROM "StaffPermission" WHERE key='balances:adjust';
