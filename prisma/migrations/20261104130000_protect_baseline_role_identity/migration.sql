-- Preserve the mandatory investor baseline identity after unified RBAC cutover.
-- An update of Role.key or deletion of Role(user) would otherwise remove
-- every account's effective baseline access, even if UserRole rows survive.
CREATE FUNCTION zenvest_protect_baseline_role_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."key" = 'user' THEN
      RAISE EXCEPTION 'Cannot modify the mandatory baseline user role';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."key" = 'user' AND NEW."key" IS DISTINCT FROM OLD."key" THEN
    RAISE EXCEPTION 'Cannot modify the mandatory baseline user role';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zenvest_reject_baseline_role_identity_change
BEFORE UPDATE OF "key" OR DELETE ON "Role"
FOR EACH ROW EXECUTE FUNCTION zenvest_protect_baseline_role_identity();
