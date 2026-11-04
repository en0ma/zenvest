-- Final unified RBAC cutover: preserve data/IDs while renaming existing role tables.
-- Application code and Prisma no longer read users.role.
ALTER TABLE "users" DROP COLUMN "role";
DROP TYPE "Role";
ALTER TABLE "StaffRole" RENAME TO "Role";
ALTER TABLE "StaffPermission" RENAME TO "Permission";
ALTER TABLE "StaffRolePermission" RENAME TO "RolePermission";
ALTER TABLE "StaffRoleMembership" RENAME TO "UserRole";
-- Existing PK, FK, unique indexes and privilege records survive renames.
CREATE OR REPLACE FUNCTION zenvest_assign_baseline_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "UserRole" ("userId","roleId","assignedBy")
 SELECT NEW.id,r.id,'SYSTEM' FROM "Role" r WHERE r.key='user'
 ON CONFLICT DO NOTHING;
 IF NOT EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id=ur."roleId"
                WHERE ur."userId"=NEW.id AND r.key='user')
 THEN RAISE EXCEPTION 'Missing baseline user role for account'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION zenvest_protect_baseline_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "Role" r WHERE r.id=OLD."roleId" AND r.key='user')
 AND EXISTS (SELECT 1 FROM "users" u WHERE u.id=OLD."userId")
 THEN RAISE EXCEPTION 'Cannot revoke the mandatory baseline user role'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zenvest_reject_baseline_revocation
 BEFORE DELETE OR UPDATE OF "roleId" ON "UserRole"
 FOR EACH ROW EXECUTE FUNCTION zenvest_protect_baseline_role();
