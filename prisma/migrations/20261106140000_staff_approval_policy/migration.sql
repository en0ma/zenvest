-- Super Admin is the immutable default approver. Other eligible roles are an
-- opt-in per-instance setting changed only through the Super Admin endpoint.
CREATE TABLE "StaffApprovalPolicy" (
 "id" TEXT PRIMARY KEY,
 "additionalRoleKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "StaffApprovalPolicy_singleton" CHECK ("id"='admin-actions'),
 CONSTRAINT "StaffApprovalPolicy_allowed_roles" CHECK (
   "additionalRoleKeys" <@ ARRAY['operations','finance','support','auditor']::TEXT[])
);
INSERT INTO "StaffApprovalPolicy" ("id") VALUES ('admin-actions');
