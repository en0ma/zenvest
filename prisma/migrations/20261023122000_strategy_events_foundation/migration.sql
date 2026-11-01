CREATE TYPE "StrategyEventKind" AS ENUM ('ALLOCATE', 'DEALLOCATE');
CREATE TYPE "StrategyEventStatus" AS ENUM ('PROCESSING', 'CONFIRMING', 'COMPLETED');
CREATE TABLE "strategy_events" (
 "id" TEXT NOT NULL,
 "kind" "StrategyEventKind" NOT NULL,
 "amount_usdc_micros" BIGINT NOT NULL,
 "strategy_id" VARCHAR(64) NOT NULL,
 "status" "StrategyEventStatus" NOT NULL DEFAULT 'PROCESSING',
 "treasury_transaction_id" TEXT,
 "source_confirmed" BOOLEAN NOT NULL DEFAULT false,
 "destination_confirmed" BOOLEAN NOT NULL DEFAULT false,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "strategy_events_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "strategy_events_amount_positive" CHECK ("amount_usdc_micros" > 0),
 CONSTRAINT "strategy_events_destination_requires_source" CHECK (NOT "destination_confirmed" OR "source_confirmed"),
 CONSTRAINT "strategy_events_completed_requires_both" CHECK ("status" <> 'COMPLETED' OR ("source_confirmed" AND "destination_confirmed"))
);
CREATE UNIQUE INDEX "strategy_events_treasury_transaction_id_key" ON "strategy_events"("treasury_transaction_id");
CREATE INDEX "strategy_events_strategy_id_kind_status_created_at_idx" ON "strategy_events"("strategy_id","kind","status","created_at");
ALTER TABLE "strategy_events" ADD CONSTRAINT "strategy_events_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "strategy_events" ADD CONSTRAINT "strategy_events_treasury_transaction_id_fkey" FOREIGN KEY ("treasury_transaction_id") REFERENCES "treasury_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
