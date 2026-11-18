CREATE TABLE "sandbox_settlements"(
 "id" TEXT NOT NULL PRIMARY KEY,
 "strategy_id" VARCHAR(64) NOT NULL,
 "event_id" VARCHAR(180) NOT NULL,
 "result" VARCHAR(3) NOT NULL,
 "payout_micros" BIGINT NOT NULL,
 "realized_pnl_micros" BIGINT NOT NULL,
 "provider_evidence" JSONB NOT NULL,
 "observed_at" TIMESTAMP(3) NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "sandbox_settlements_strategy_id_fkey" FOREIGN KEY("strategy_id") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE UNIQUE INDEX "sandbox_settlements_strategy_id_event_id_key" ON "sandbox_settlements"("strategy_id","event_id");
CREATE INDEX "sandbox_settlements_strategy_id_created_at_idx" ON "sandbox_settlements"("strategy_id","created_at");
-- Existing bot strategies created before public keys were introduced.
UPDATE "strategies" SET "public_key"='zvs_'||md5(random()::text||id||clock_timestamp()::text)
WHERE id IN (SELECT strategy_id FROM "bots") AND public_key IS NULL;
