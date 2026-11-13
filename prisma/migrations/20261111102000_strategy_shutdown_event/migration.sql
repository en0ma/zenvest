ALTER TABLE "strategies" ADD COLUMN "shutdown_event_id" VARCHAR(64);
CREATE UNIQUE INDEX "strategies_shutdown_event_id_key" ON "strategies"("shutdown_event_id");
