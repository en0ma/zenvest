-- Preserve the live invested amount; no historical P&L is inferred or backfilled.
ALTER TYPE "StrategyTradeStatus" RENAME TO "StrategyTradeStatus_old";
CREATE TYPE "StrategyTradeStatus" AS ENUM ('AWAITING_ALLOCATION','TRADING','SETTLED','ENDED','ERROR');
ALTER TABLE "strategy_trades" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "strategy_trades" ALTER COLUMN "status" TYPE "StrategyTradeStatus" USING ("status"::text)::"StrategyTradeStatus";
DROP TYPE "StrategyTradeStatus_old";
ALTER TYPE "PositionStatus" RENAME TO "PositionStatus_old";
CREATE TYPE "PositionStatus" AS ENUM ('OPEN','CLOSING','CLOSED');
ALTER TABLE "positions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "positions" ALTER COLUMN "status" TYPE "PositionStatus" USING (CASE WHEN "status"::text='CLOSED' THEN 'CLOSED' ELSE 'OPEN' END)::"PositionStatus";
ALTER TABLE "positions" ALTER COLUMN "status" SET DEFAULT 'OPEN';
DROP TYPE "PositionStatus_old";
ALTER TABLE "positions" RENAME COLUMN "principal_usdc_micros" TO "allocated_usdc_micros";
ALTER TABLE "positions" DROP COLUMN "realized_pnl_usdc_micros";
ALTER TABLE "positions" ADD COLUMN "last_pnl_updated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "strategy_trades" ALTER COLUMN "status" SET DEFAULT 'AWAITING_ALLOCATION';
ALTER TABLE "strategy_trades" ADD COLUMN "is_pnl_calculated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "strategy_trades" ADD COLUMN "eligible_capital_usdc_micros" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "strategy_trades" ADD COLUMN "applied_platform_profit_percentage" DECIMAL(7,4);
CREATE TYPE "PositionTradePnlStatus" AS ENUM ('SNAPSHOTTED','SETTLED');
CREATE TABLE "position_trade_pnl" (
 "id" TEXT PRIMARY KEY,
 "strategy_trade_id" VARCHAR(64) NOT NULL REFERENCES "strategy_trades"("id") ON DELETE RESTRICT,
 "position_id" TEXT NOT NULL REFERENCES "positions"("id") ON DELETE RESTRICT,
 "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "eligible_capital_usdc_micros" BIGINT NOT NULL CHECK("eligible_capital_usdc_micros">0),
 "gross_pnl_usdc_micros" BIGINT,
 "platform_fee_usdc_micros" BIGINT,
 "net_pnl_usdc_micros" BIGINT,
 "status" "PositionTradePnlStatus" NOT NULL DEFAULT 'SNAPSHOTTED',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "settled_at" TIMESTAMP(3),
 CONSTRAINT "position_trade_pnl_strategy_trade_id_position_id_key" UNIQUE("strategy_trade_id","position_id"),
 CONSTRAINT "position_trade_pnl_settlement_complete" CHECK ((status='SNAPSHOTTED' AND gross_pnl_usdc_micros IS NULL AND platform_fee_usdc_micros IS NULL AND net_pnl_usdc_micros IS NULL AND settled_at IS NULL) OR (status='SETTLED' AND gross_pnl_usdc_micros IS NOT NULL AND platform_fee_usdc_micros IS NOT NULL AND net_pnl_usdc_micros IS NOT NULL AND settled_at IS NOT NULL AND gross_pnl_usdc_micros-platform_fee_usdc_micros=net_pnl_usdc_micros))
);
CREATE INDEX "position_trade_pnl_user_id_status_settled_at_idx" ON "position_trade_pnl"("user_id","status","settled_at");
CREATE INDEX "position_trade_pnl_position_id_status_settled_at_idx" ON "position_trade_pnl"("position_id","status","settled_at");
CREATE INDEX "strategy_trades_pnl_pending_idx" ON "strategy_trades"("status","is_pnl_calculated","market_end","created_at");
-- Historical ENDED trades are not silently marked SETTLED: require independent verification.
