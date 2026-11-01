ALTER TABLE "webhook_queue" ADD COLUMN "lease_until" TIMESTAMP(3);
ALTER TABLE "webhook_queue" ADD COLUMN "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "webhook_queue" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "webhook_queue" ADD COLUMN "last_error" VARCHAR(200);
CREATE INDEX "webhook_queue_pending_schedule_idx" ON "webhook_queue" ("status","next_attempt_at","lease_until");
