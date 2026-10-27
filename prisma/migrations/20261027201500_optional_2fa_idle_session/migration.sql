ALTER TABLE "users" ADD COLUMN "last_activity_at" TIMESTAMP(3);
CREATE TABLE "TwoFactor" ("user_id" TEXT NOT NULL, "method" VARCHAR(16) NOT NULL, "secret_encrypted" TEXT, "last_totp_step" BIGINT NOT NULL DEFAULT -1, "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TwoFactor_pkey" PRIMARY KEY ("user_id"));
CREATE TABLE "TwoFactorChallenge" ("id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "purpose" VARCHAR(16) NOT NULL, "method" VARCHAR(16) NOT NULL, "code_hash" TEXT, "attempts" INTEGER NOT NULL DEFAULT 0, "expires_at" TIMESTAMP(3) NOT NULL, "consumed_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TwoFactorChallenge_pkey" PRIMARY KEY ("id"));
ALTER TABLE "TwoFactor" ADD CONSTRAINT "TwoFactor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "TwoFactorChallenge_user_id_purpose_created_at_idx" ON "TwoFactorChallenge"("user_id","purpose","created_at");
CREATE INDEX "TwoFactorChallenge_expires_at_idx" ON "TwoFactorChallenge"("expires_at");
