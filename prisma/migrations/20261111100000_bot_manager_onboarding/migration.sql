ALTER TYPE "StrategyStatus" ADD VALUE IF NOT EXISTS 'ONBOARDING';
ALTER TYPE "StrategyStatus" ADD VALUE IF NOT EXISTS 'SHUTTING_DOWN';
ALTER TYPE "StrategyStatus" ADD VALUE IF NOT EXISTS 'SHUTDOWN';
CREATE TABLE "bots" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "owner_id" TEXT NOT NULL,
 "strategy_id" VARCHAR(64) NOT NULL,
 "name" VARCHAR(120) NOT NULL,
 "description" VARCHAR(500) NOT NULL DEFAULT '',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "bots_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "bots_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "bots_strategy_id_key" ON "bots"("strategy_id");
CREATE INDEX "bots_owner_id_created_at_idx" ON "bots"("owner_id","created_at");
CREATE TABLE "bot_api_keys" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "bot_id" TEXT NOT NULL,
 "label" VARCHAR(100) NOT NULL,
 "key_hash" CHAR(64) NOT NULL,
 "key_prefix" VARCHAR(20) NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "revoked_at" TIMESTAMP(3),
 "last_used_at" TIMESTAMP(3),
 CONSTRAINT "bot_api_keys_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "bot_api_keys_key_hash_key" ON "bot_api_keys"("key_hash");
CREATE INDEX "bot_api_keys_bot_id_revoked_at_idx" ON "bot_api_keys"("bot_id","revoked_at");
INSERT INTO "Permission" ("id","key","description")
SELECT 'bot_manage_own_permission','bots:manage:own','Manage own bots and API keys.'
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "key"='bots:manage:own');
INSERT INTO "Role" ("id","key") SELECT 'bot_role_baseline','bot'
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE "key"='bot');
INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."key"='bot' AND p."key"='bots:manage:own' ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."key"='super-admin' AND p."key"='bots:manage:own' ON CONFLICT DO NOTHING;
