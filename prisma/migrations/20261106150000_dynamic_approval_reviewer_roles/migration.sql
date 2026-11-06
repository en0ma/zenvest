-- Allow dynamic administrator-created role keys in the reviewer policy.
-- The API checks that each key refers to an existing, non-protected role.
ALTER TABLE "StaffApprovalPolicy" DROP CONSTRAINT "StaffApprovalPolicy_allowed_roles";
ALTER TABLE "StaffApprovalPolicy" ADD CONSTRAINT "StaffApprovalPolicy_allowed_roles"
 CHECK (
   cardinality("additionalRoleKeys")=0
   OR (
     array_to_string("additionalRoleKeys",',') ~ '^[a-z][a-z0-9-]{2,39}(,[a-z][a-z0-9-]{2,39})*$'
     AND NOT ('user'=ANY("additionalRoleKeys"))
     AND NOT ('super-admin'=ANY("additionalRoleKeys"))
   )
 );
