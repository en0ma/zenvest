-- Preserve event request idempotency, but only webhook_queue may use
-- the physical database column name idempotency_key (check-ci-db.mjs invariant).
ALTER TABLE "bot_trade_intents" RENAME COLUMN "idempotency_key" TO "request_dedupe_key";
