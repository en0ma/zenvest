ALTER TABLE "strategies" ADD COLUMN "is_showcase" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "strategies" ADD COLUMN "display_allocation_usdc_micros" BIGINT NOT NULL DEFAULT 0;
CREATE TABLE "strategy_display_trades" (
 "id" VARCHAR(100) PRIMARY KEY,
 "strategy_id" VARCHAR(64) NOT NULL REFERENCES "strategies"("id") ON DELETE CASCADE,
 "occurred_at" TIMESTAMP(3) NOT NULL,
 "net_pnl_usdc_micros" BIGINT NOT NULL,
 "eligible_capital_usdc_micros" BIGINT NOT NULL
);
CREATE INDEX "strategy_display_trades_strategy_id_occurred_at_idx" ON "strategy_display_trades"("strategy_id","occurred_at");
