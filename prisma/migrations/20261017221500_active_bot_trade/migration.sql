-- Bot identities must exist before Python bot trade snapshots can reference them.
CREATE TABLE "bots" (
  "id" VARCHAR(64) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  CONSTRAINT "bots_pkey" PRIMARY KEY ("id")
);

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
ALTER TABLE "active_bot_trade" ADD CONSTRAINT "active_bot_trade_bot_id_fkey"
  FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
