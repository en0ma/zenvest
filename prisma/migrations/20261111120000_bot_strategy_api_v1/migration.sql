ALTER TABLE "strategies" ADD COLUMN "venue" VARCHAR(32);
ALTER TABLE "strategies" ADD COLUMN "event_tag" VARCHAR(120);
ALTER TABLE "strategies" ADD COLUMN "event_side" VARCHAR(8);

CREATE TABLE "bot_api_rate_limits" (
  "key_id" TEXT NOT NULL,
  "window_start" TIMESTAMP(3) NOT NULL,
  "request_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "bot_api_rate_limits_pkey" PRIMARY KEY ("key_id","window_start"),
  CONSTRAINT "bot_api_rate_limits_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "bot_api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "bot_api_rate_limits_window_start_idx" ON "bot_api_rate_limits"("window_start");

CREATE TABLE "bot_trade_intents" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "bot_id" TEXT NOT NULL,
 "strategy_id" VARCHAR(64) NOT NULL,
 "key_id" TEXT NOT NULL,
 "idempotency_key" VARCHAR(100) NOT NULL,
 "order_type" VARCHAR(4) NOT NULL,
 "trade_size" INTEGER NOT NULL,
 "event_id" VARCHAR(180) NOT NULL,
 "side" VARCHAR(8) NOT NULL,
 "status" VARCHAR(32) NOT NULL DEFAULT 'RECEIVED_UNEXECUTED',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "bot_trade_intents_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "bot_trade_intents_strategy_id_idempotency_key_key" ON "bot_trade_intents"("strategy_id","idempotency_key");
CREATE INDEX "bot_trade_intents_bot_id_created_at_idx" ON "bot_trade_intents"("bot_id","created_at");
