ALTER TABLE "strategy_trades" ADD COLUMN "applied_manager_profit_percentage" DECIMAL(7,4);
ALTER TABLE "strategy_trades" ADD COLUMN "applied_platform_strategy_percentage" DECIMAL(7,4);
CREATE TABLE "bot_strategy_revenue_accounting"(
 "id" TEXT NOT NULL PRIMARY KEY,
 "strategy_id" VARCHAR(64) NOT NULL,
 "strategy_trade_id" VARCHAR(64) NOT NULL,
 "owner_id" TEXT NOT NULL,
 "gross_verified_pnl_micros" BIGINT NOT NULL,
 "existing_platform_fee_micros" BIGINT NOT NULL,
 "existing_investor_net_micros" BIGINT NOT NULL,
 "manager_pct" DECIMAL(7,4) NOT NULL,
 "platform_pct" DECIMAL(7,4) NOT NULL,
 "candidate_manager_micros" BIGINT NOT NULL,
 "candidate_platform_micros" BIGINT NOT NULL,
 "candidate_investor_micros" BIGINT NOT NULL,
 "status" VARCHAR(40) NOT NULL DEFAULT 'POLICY_PENDING_NO_PAYOUT',
 "settled_at" TIMESTAMP(3) NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "bot_strategy_revenue_accounting_strategy_id_fkey" FOREIGN KEY("strategy_id") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "bot_strategy_revenue_accounting_strategy_trade_id_fkey" FOREIGN KEY("strategy_trade_id") REFERENCES "strategy_trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "bot_strategy_revenue_accounting_candidate_conservation" CHECK (
  candidate_manager_micros+candidate_platform_micros+candidate_investor_micros=gross_verified_pnl_micros),
 CONSTRAINT "bot_strategy_revenue_accounting_no_negative_candidate" CHECK (
  candidate_manager_micros>=0 AND candidate_platform_micros>=0),
 CONSTRAINT "bot_strategy_revenue_accounting_nonpayable" CHECK (status='POLICY_PENDING_NO_PAYOUT')
);
CREATE UNIQUE INDEX "bot_strategy_revenue_accounting_strategy_trade_id_key" ON "bot_strategy_revenue_accounting"("strategy_trade_id");
CREATE INDEX "bot_strategy_revenue_accounting_owner_id_settled_at_idx" ON "bot_strategy_revenue_accounting"("owner_id","settled_at");
CREATE INDEX "bot_strategy_revenue_accounting_strategy_id_settled_at_idx" ON "bot_strategy_revenue_accounting"("strategy_id","settled_at");
