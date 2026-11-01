ALTER TABLE "strategy_events" ADD COLUMN "kalshi_withdrawal_id" VARCHAR(200);
CREATE UNIQUE INDEX "strategy_events_kalshi_withdrawal_id_key" ON "strategy_events"("kalshi_withdrawal_id");
