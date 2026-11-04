INSERT INTO "StaffRole" ("id","key") VALUES ('rbac_user_baseline','user') ON CONFLICT ("key") DO NOTHING;
INSERT INTO "StaffPermission" ("id","key") VALUES
('rbac_account_access','account:access'),
('rbac_portfolio_own','portfolio:read:own'),
('rbac_wallet_own','wallet:read:own'),
('rbac_deposits_own','deposits:create:own'),
('rbac_withdrawals_own','withdrawals:create:own'),
('rbac_allocations_own','allocations:create:own')
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "StaffRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "StaffRole" r CROSS JOIN "StaffPermission" p
WHERE r.key='user' AND p.key IN
('account:access','portfolio:read:own','wallet:read:own','deposits:create:own','withdrawals:create:own','allocations:create:own')
ON CONFLICT DO NOTHING;
INSERT INTO "StaffRoleMembership" ("userId","roleId","assignedBy")
SELECT u.id,r.id,'SYSTEM' FROM "users" u CROSS JOIN "StaffRole" r WHERE r.key='user'
ON CONFLICT DO NOTHING;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "StaffRoleMembership" m LEFT JOIN "users" u ON u.id=m."userId" WHERE u.id IS NULL)
 THEN RAISE EXCEPTION 'Orphaned user-role membership; reconcile before migration'; END IF;
END $$;
ALTER TABLE "StaffRoleMembership" ADD CONSTRAINT "StaffRoleMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
CREATE FUNCTION zenvest_assign_baseline_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "StaffRoleMembership" ("userId","roleId","assignedBy")
 SELECT NEW.id,id,'SYSTEM' FROM "StaffRole" WHERE key='user' ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER zenvest_assign_baseline_role_after_signup
AFTER INSERT ON "users" FOR EACH ROW EXECUTE FUNCTION zenvest_assign_baseline_role();
