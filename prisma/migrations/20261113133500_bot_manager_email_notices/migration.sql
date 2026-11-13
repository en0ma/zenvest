CREATE TABLE "bot_manager_notices" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "user_id" TEXT NOT NULL,
 "kind" VARCHAR(24) NOT NULL,
 "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "sent_at" TIMESTAMP(3),
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "bot_manager_notices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE INDEX "bot_manager_notices_status_next_attempt_at_idx" ON "bot_manager_notices"("status","next_attempt_at");
