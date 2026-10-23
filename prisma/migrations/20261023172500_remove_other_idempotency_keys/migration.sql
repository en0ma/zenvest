-- Keep provider webhook deduplication exclusively in webhook_queue.
-- Withdrawal/position client requests no longer store deduplication keys.
ALTER TABLE "withdrawals" DROP COLUMN "idempotency_key";
DROP TABLE "position_event_requests";
