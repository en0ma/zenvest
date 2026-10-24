-- Move legacy deallocations into the single per-investor position event stream.
-- Preserve identity, idempotency reference, statuses and timestamps. Strategy is
-- derived from the authoritative position FK (never trusted from user input).
INSERT INTO "position_events"
 ("id","position_id","user_id","strategy_id","kind","amount_usdc_micros",
  "treasury_id","status","request_key","provider_reference",
  "created_at","updated_at","completed_at")
SELECT d."id", d."position_id", d."user_id", p."strategy_id", 'DEALLOCATE'::"StrategyEventKind",
       d."amount_usdc_micros",d."treasury_id",d."status",d."request_key",
       d."provider_reference",d."created_at",d."updated_at",d."completed_at"
FROM "position_deallocations" d
JOIN "positions" p ON p."id"=d."position_id";
-- The old table is no longer queried by the application after this migration.
DROP TABLE "position_deallocations";
