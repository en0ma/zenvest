CREATE TYPE "StaffActionStatus" AS ENUM ('PENDING','APPROVED','REJECTED','EXECUTED');
CREATE TABLE "StaffRole" ("id" TEXT PRIMARY KEY,"key" TEXT NOT NULL UNIQUE);
CREATE TABLE "StaffPermission" ("id" TEXT PRIMARY KEY,"key" TEXT NOT NULL UNIQUE);
CREATE TABLE "StaffRolePermission" ("roleId" TEXT NOT NULL REFERENCES "StaffRole"("id") ON DELETE CASCADE,"permissionId" TEXT NOT NULL REFERENCES "StaffPermission"("id") ON DELETE CASCADE,PRIMARY KEY ("roleId","permissionId"));
CREATE TABLE "StaffRoleMembership" ("userId" TEXT NOT NULL,"roleId" TEXT NOT NULL REFERENCES "StaffRole"("id") ON DELETE CASCADE,"assignedBy" TEXT NOT NULL,PRIMARY KEY ("userId","roleId"));
CREATE TABLE "StaffAction" ("id" TEXT PRIMARY KEY,"resource" TEXT NOT NULL,"operation" TEXT NOT NULL,"targetId" TEXT NOT NULL,"payload" JSONB NOT NULL,"reason" TEXT NOT NULL,"requestedBy" TEXT NOT NULL,"decidedBy" TEXT,"status" "StaffActionStatus" NOT NULL DEFAULT 'PENDING',"idempotencyKey" TEXT NOT NULL UNIQUE,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"decidedAt" TIMESTAMP(3));
CREATE INDEX "StaffAction_status_createdAt_idx" ON "StaffAction"("status","createdAt");
CREATE TABLE "StaffAudit" ("id" TEXT PRIMARY KEY,"actorId" TEXT NOT NULL,"action" TEXT NOT NULL,"resource" TEXT NOT NULL,"targetId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "StaffAudit_actorId_createdAt_idx" ON "StaffAudit"("actorId","createdAt");
