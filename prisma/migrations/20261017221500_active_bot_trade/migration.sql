CREATE TABLE "active_bot_trade" (
  "bot_id" VARCHAR(64) NOT NULL,
  "status" "BotRunState" NOT NULL DEFAULT 'OFFLINE',
  "event_ticker" VARCHAR(200),
  "yes_contracts" INTEGER NOT NULL DEFAULT 0,
  "no_contracts" INTEGER NOT NULL DEFAULT 0,
  "yes_cost_usdc_micros" BIGINT NOT NULL DEFAULT 0,
  "no_cost_usdc_micros" BIGINT NOT NULL DEFAULT 0,
  "as_of" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "active_bot_trade_pkey" PRIMARY KEY ("bot_id"),
  CONSTRAINT "active_bot_trade_nonnegative_check" CHECK ("yes_contracts" >= 0 AND "no_contracts" >= 0 AND "yes_cost_usdc_micros" >= 0 AND "no_cost_usdc_micros" >= 0)
);
