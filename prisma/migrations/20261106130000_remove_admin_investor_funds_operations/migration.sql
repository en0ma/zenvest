-- Retire admin actions which could touch investor deposits and withdrawals.
-- Keep existing StaffAction and StaffAudit entries for historical investigation.
DELETE FROM "Permission" WHERE "key" IN ('deposits:reconcile','withdrawals:approve');
-- New writes fail, while historical actions are preserved without validation.
ALTER TABLE "StaffAction" ADD CONSTRAINT "StaffAction_no_admin_investor_funds"
 CHECK (NOT (("resource"='deposits' AND "operation"='reconcile')
         OR ("resource"='withdrawals' AND "operation"='approve'))) NOT VALID;
