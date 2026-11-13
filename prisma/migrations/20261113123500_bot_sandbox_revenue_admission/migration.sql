ALTER TABLE "strategies" ADD COLUMN "public_key" VARCHAR(64);
CREATE UNIQUE INDEX "strategies_public_key_key" ON "strategies"("public_key");
ALTER TABLE "strategies" ADD COLUMN "manager_profit_percentage" DECIMAL(7,4) NOT NULL DEFAULT 0;
ALTER TABLE "strategies" ADD COLUMN "platform_strategy_percentage" DECIMAL(7,4) NOT NULL DEFAULT 0;
ALTER TABLE "strategies" ADD COLUMN "sandbox_fee_bps" INTEGER;
ALTER TABLE "strategies" ADD COLUMN "admission_min_days" INTEGER;
ALTER TABLE "strategies" ADD COLUMN "admission_min_fills" INTEGER;
ALTER TABLE "strategies" ADD COLUMN "admission_max_drawdown_pct" DECIMAL(7,4);
CREATE TABLE "sandbox_accounts"(
 "strategy_id" VARCHAR(64) NOT NULL PRIMARY KEY,
 "initial_cash_micros" BIGINT NOT NULL DEFAULT 10000000000,
 "cash_micros" BIGINT NOT NULL DEFAULT 10000000000,
 "realized_pnl_micros" BIGINT NOT NULL DEFAULT 0,
 "peak_equity_micros" BIGINT NOT NULL DEFAULT 10000000000,
 "max_drawdown_bps" INTEGER NOT NULL DEFAULT 0,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "sandbox_accounts_strategy_id_fkey" FOREIGN KEY("strategy_id") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE TABLE "sandbox_fills"(
 "id" TEXT NOT NULL PRIMARY KEY,
 "strategy_id" VARCHAR(64) NOT NULL,
 "key_id" TEXT NOT NULL,
 "request_key" VARCHAR(100) NOT NULL,
 "event_id" VARCHAR(180) NOT NULL,
 "side" VARCHAR(3) NOT NULL,
 "order_type" VARCHAR(4) NOT NULL,
 "quantity" INTEGER NOT NULL,
 "price_micros" BIGINT NOT NULL,
 "notional_micros" BIGINT NOT NULL,
 "estimated_fee_micros" BIGINT NOT NULL,
 "realized_pnl_micros" BIGINT NOT NULL DEFAULT 0,
 "book_snapshot" JSONB NOT NULL,
 "venue_observed_at" TIMESTAMP(3) NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "sandbox_fills_strategy_id_fkey" FOREIGN KEY("strategy_id") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE UNIQUE INDEX "sandbox_fills_strategy_id_request_key_key" ON "sandbox_fills"("strategy_id","request_key");
CREATE INDEX "sandbox_fills_strategy_id_created_at_idx" ON "sandbox_fills"("strategy_id","created_at");
CREATE TABLE "sandbox_positions"(
 "strategy_id" VARCHAR(64) NOT NULL,
 "event_id" VARCHAR(180) NOT NULL,
 "side" VARCHAR(3) NOT NULL,
 "quantity" INTEGER NOT NULL DEFAULT 0,
 "cost_basis_micros" BIGINT NOT NULL DEFAULT 0,
 CONSTRAINT "sandbox_positions_pkey" PRIMARY KEY("strategy_id","event_id","side"));
CREATE TABLE "strategy_revenue_rate_versions"(
 "id" TEXT NOT NULL PRIMARY KEY,
 "strategy_id" VARCHAR(64) NOT NULL,
 "manager_pct" DECIMAL(7,4) NOT NULL,
 "platform_pct" DECIMAL(7,4) NOT NULL,
 "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "changed_by" TEXT NOT NULL,
 CONSTRAINT "strategy_revenue_rate_versions_strategy_id_fkey" FOREIGN KEY("strategy_id") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE INDEX "strategy_revenue_rate_versions_strategy_id_effective_at_idx" ON "strategy_revenue_rate_versions"("strategy_id","effective_at");
ALTER TABLE "strategies" ADD CONSTRAINT "strategy_revenue_shares_valid" CHECK(
 manager_profit_percentage>=0 AND platform_strategy_percentage>=0
 AND manager_profit_percentage+platform_strategy_percentage<=100);
ALTER TABLE "strategies" ADD CONSTRAINT "strategy_sandbox_policy_valid" CHECK(
 (sandbox_fee_bps IS NULL OR sandbox_fee_bps BETWEEN 0 AND 10000)
 AND (admission_min_days IS NULL OR admission_min_days BETWEEN 1 AND 365)
 AND (admission_min_fills IS NULL OR admission_min_fills BETWEEN 1 AND 100000)
 AND (admission_max_drawdown_pct IS NULL OR admission_max_drawdown_pct BETWEEN 0 AND 100));
