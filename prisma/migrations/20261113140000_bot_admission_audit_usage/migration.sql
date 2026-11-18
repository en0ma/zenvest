ALTER TABLE "bot_api_rate_limits" ADD COLUMN "rejected_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bot_trade_intents" ADD COLUMN "applied_manager_profit_pct" DECIMAL(7,4);
ALTER TABLE "bot_trade_intents" ADD COLUMN "applied_platform_strategy_pct" DECIMAL(7,4);
CREATE TABLE "bot_admission_overrides"(
 "id" TEXT NOT NULL PRIMARY KEY,
 "strategy_id" VARCHAR(64) NOT NULL,
 "actor_id" TEXT NOT NULL,
 "from_status" VARCHAR(24) NOT NULL,
 "to_status" VARCHAR(24) NOT NULL,
 "reason" VARCHAR(1000) NOT NULL,
 "failed_rules" JSONB NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "bot_admission_overrides_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE INDEX "bot_admission_overrides_strategy_id_created_at_idx" ON "bot_admission_overrides"("strategy_id","created_at");
