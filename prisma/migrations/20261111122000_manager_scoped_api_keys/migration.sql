-- Existing draft credentials are migrated from bot scope to manager scope.
-- The raw token is not touched; every active key now authenticates its owner's strategies.
ALTER TABLE "bot_api_keys" ADD COLUMN "owner_id" TEXT;
UPDATE "bot_api_keys" k SET "owner_id" = b."owner_id" FROM "bots" b WHERE k."bot_id" = b."id";
ALTER TABLE "bot_api_keys" ALTER COLUMN "owner_id" SET NOT NULL;
ALTER TABLE "bot_api_keys" DROP CONSTRAINT "bot_api_keys_bot_id_fkey";
DROP INDEX "bot_api_keys_bot_id_revoked_at_idx";
ALTER TABLE "bot_api_keys" DROP COLUMN "bot_id";
CREATE INDEX "bot_api_keys_owner_id_revoked_at_idx" ON "bot_api_keys"("owner_id","revoked_at");
ALTER TABLE "bot_api_keys" ADD CONSTRAINT "bot_api_keys_owner_id_fkey"
 FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
