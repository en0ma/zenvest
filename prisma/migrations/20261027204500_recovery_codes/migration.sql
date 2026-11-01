CREATE TABLE "TwoFactorRecoveryCode" ("id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "hash" CHAR(64) NOT NULL, "used_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TwoFactorRecoveryCode_pkey" PRIMARY KEY ("id"));
ALTER TABLE "TwoFactorRecoveryCode" ADD CONSTRAINT "TwoFactorRecoveryCode_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "TwoFactorRecoveryCode_hash_key" ON "TwoFactorRecoveryCode"("hash");
CREATE INDEX "TwoFactorRecoveryCode_userId_usedAt_idx" ON "TwoFactorRecoveryCode"("user_id","used_at");
