CREATE TABLE "bot_trade_verified_costs" (
 "strategy_trade_id" VARCHAR(64) NOT NULL PRIMARY KEY,
 "venue_fee_micros" BIGINT NOT NULL,
 "custody_fee_micros" BIGINT NOT NULL,
 "operational_fee_micros" BIGINT NOT NULL,
 "gross_pre_cost_verified" BOOLEAN NOT NULL DEFAULT false,
 "venue_evidence_ref" VARCHAR(180) NOT NULL,
 "custody_evidence_ref" VARCHAR(180) NOT NULL,
 "operations_evidence_ref" VARCHAR(180) NOT NULL,
 "verified_at" TIMESTAMP(3),
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "bot_trade_verified_costs_trade_fkey" FOREIGN KEY("strategy_trade_id") REFERENCES "strategy_trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "bot_trade_costs_nonnegative" CHECK(venue_fee_micros>=0 AND custody_fee_micros>=0 AND operational_fee_micros>=0),
 CONSTRAINT "bot_trade_cost_evidence_refs" CHECK(length(trim(venue_evidence_ref))>0 AND length(trim(custody_evidence_ref))>0 AND length(trim(operations_evidence_ref))>0)
);
