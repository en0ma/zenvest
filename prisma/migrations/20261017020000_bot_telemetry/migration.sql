CREATE TYPE "BotRunState" AS ENUM ('OFFLINE','IDLE','MONITORING','TRADING','PAUSED','ERROR');
CREATE TABLE "bot_status" (
 "bot_id" VARCHAR(64) PRIMARY KEY,
 "state" "BotRunState" NOT NULL DEFAULT 'OFFLINE',
 "current_event_ticker" VARCHAR(200),
 "current_event_closes_at" TIMESTAMP(3),
 "inventory_yes_contracts" INTEGER NOT NULL DEFAULT 0,
 "inventory_no_contracts" INTEGER NOT NULL DEFAULT 0,
 "available_funds_usdc_micros" BIGINT NOT NULL DEFAULT 0,
 "releasable_funds_usdc_micros" BIGINT NOT NULL DEFAULT 0,
 "realized_pnl_usdc_micros" BIGINT NOT NULL DEFAULT 0,
 "unrealized_pnl_usdc_micros" BIGINT NOT NULL DEFAULT 0,
 "as_of" TIMESTAMP(3) NOT NULL,
 "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "bot_trades" (
 "id" TEXT PRIMARY KEY,
 "bot_id" VARCHAR(64) NOT NULL REFERENCES "bot_status"("bot_id"),
 "external_trade_id" VARCHAR(180) NOT NULL UNIQUE,
 "event_ticker" VARCHAR(200) NOT NULL,
 "side" VARCHAR(12) NOT NULL,
 "outcome" VARCHAR(12),
 "contracts" INTEGER NOT NULL,
 "entry_cost_usdc_micros" BIGINT NOT NULL,
 "payout_usdc_micros" BIGINT,
 "fees_usdc_micros" BIGINT NOT NULL DEFAULT 0,
 "realized_pnl_usdc_micros" BIGINT,
 "opened_at" TIMESTAMP(3) NOT NULL,
 "settled_at" TIMESTAMP(3)
);
CREATE INDEX "bot_trades_bot_id_opened_at_idx" ON "bot_trades"("bot_id","opened_at");
