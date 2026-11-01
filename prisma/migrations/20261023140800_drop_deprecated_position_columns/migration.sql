-- Move event idempotency into a dedicated request-correlation table,
-- preserving all existing keys before dropping deprecated event fields.
CREATE TABLE "position_event_requests" (
 "request_key" VARCHAR(180) NOT NULL,
 "position_event_id" TEXT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "position_event_requests_pkey" PRIMARY KEY ("request_key")
);
CREATE UNIQUE INDEX "position_event_requests_position_event_id_key" ON "position_event_requests"("position_event_id");
ALTER TABLE "position_event_requests" ADD CONSTRAINT "position_event_requests_position_event_id_fkey"
 FOREIGN KEY ("position_event_id") REFERENCES "position_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "position_event_requests"("request_key","position_event_id")
 SELECT "request_key","id" FROM "position_events";
ALTER TABLE "position_events" DROP COLUMN "request_key";
ALTER TABLE "position_events" DROP COLUMN "treasury_id";
ALTER TABLE "position_events" DROP COLUMN "provider_reference";
ALTER TABLE "position_events" DROP COLUMN "completed_at";
