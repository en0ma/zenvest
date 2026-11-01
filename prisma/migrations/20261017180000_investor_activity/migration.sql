-- Investor activity records are informational and are not a double-entry ledger.
-- Entries can only be inserted by future authenticated, reconciled workflows.
CREATE TYPE "InvestorActivityType" AS ENUM ('DEPOSIT_REQUESTED','DEPOSIT_CONFIRMED','ALLOCATION','DEALLOCATION','TRADE_SETTLEMENT','WITHDRAWAL_REQUESTED','WITHDRAWAL_COMPLETED','ADJUSTMENT');

CREATE TABLE "investor_activity" (
  "id" TEXT NOT NULL,
  "portfolio_id" TEXT NOT NULL,
  "type" "InvestorActivityType" NOT NULL,
  "amount_kobo" BIGINT NOT NULL,
  "reference" VARCHAR(180),
  "description" VARCHAR(320) NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "investor_activity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "investor_activity_reference_key" ON "investor_activity"("reference");
CREATE INDEX "investor_activity_portfolio_id_occurred_at_idx" ON "investor_activity"("portfolio_id","occurred_at");
ALTER TABLE "investor_activity" ADD CONSTRAINT "investor_activity_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "investor_portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
