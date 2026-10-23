CREATE TYPE "WebhookSource" AS ENUM ('BLOCKRADAR','KALSHI');
CREATE TYPE "WebhookQueueStatus" AS ENUM ('PENDING','PROCESSED');
CREATE TABLE "webhook_queue" (
"id" TEXT NOT NULL,
"source" "WebhookSource" NOT NULL,
"event_type" VARCHAR(120) NOT NULL,
"idempotency_key" VARCHAR(200) NOT NULL,
"payload" JSONB NOT NULL,
"status" "WebhookQueueStatus" NOT NULL DEFAULT 'PENDING',
"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updated_at" TIMESTAMP(3) NOT NULL,
"processed_at" TIMESTAMP(3),
CONSTRAINT "webhook_queue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "webhook_queue_source_idempotency_key_key" ON "webhook_queue"("source","idempotency_key");
CREATE INDEX "webhook_queue_status_created_at_idx" ON "webhook_queue"("status","created_at");
