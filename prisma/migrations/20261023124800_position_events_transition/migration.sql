-- Transitional, non-destructive schema step: reuse the existing allocation records
-- while downstream workers and deallocation API are migrated to the unified table.
ALTER TABLE "position_allocations" RENAME TO "position_events";
ALTER TABLE "position_events" ADD COLUMN "kind" "StrategyEventKind" NOT NULL DEFAULT 'ALLOCATE';
ALTER TABLE "position_events" ADD COLUMN "strategy_id" VARCHAR(64);
ALTER TABLE "position_events" ADD COLUMN "strategy_event_id" TEXT;
UPDATE "position_events" AS e SET "strategy_id" = p."strategy_id"
 FROM "positions" AS p WHERE e."position_id"=p."id";
ALTER TABLE "position_events" ALTER COLUMN "strategy_id" SET NOT NULL;
ALTER TABLE "position_events" ADD CONSTRAINT "position_events_strategy_id_fkey"
 FOREIGN KEY ("strategy_id") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_events" ADD CONSTRAINT "position_events_strategy_event_id_fkey"
 FOREIGN KEY ("strategy_event_id") REFERENCES "strategy_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "position_events_strategy_id_kind_strategy_event_id_status_idx"
 ON "position_events"("strategy_id","kind","strategy_event_id","status");
