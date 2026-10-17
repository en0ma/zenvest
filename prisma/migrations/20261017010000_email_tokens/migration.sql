CREATE TYPE "TokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3), ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "action_tokens" (
 "id" TEXT NOT NULL,
 "user_id" TEXT NOT NULL,
 "purpose" "TokenPurpose" NOT NULL,
 "hash" CHAR(64) NOT NULL,
 "expires_at" TIMESTAMP(3) NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "action_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "action_tokens_hash_key" ON "action_tokens"("hash");
CREATE INDEX "action_tokens_user_id_purpose_idx" ON "action_tokens"("user_id","purpose");
CREATE INDEX "action_tokens_expires_at_idx" ON "action_tokens"("expires_at");
ALTER TABLE "action_tokens" ADD CONSTRAINT "action_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
