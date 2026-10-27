CREATE TABLE "SecuritySession" ("id" VARCHAR(64) NOT NULL, "user_id" TEXT NOT NULL, "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SecuritySession_pkey" PRIMARY KEY ("id"));
ALTER TABLE "SecuritySession" ADD CONSTRAINT "SecuritySession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "SecuritySession_userId_idx" ON "SecuritySession"("user_id");
CREATE INDEX "SecuritySession_lastActivityAt_idx" ON "SecuritySession"("last_activity_at");
