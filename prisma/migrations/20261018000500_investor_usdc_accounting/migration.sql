-- USDC amounts are stored in integer micros. Legacy NGN kobo values are retained; no implicit FX conversion.
ALTER TABLE "investor_portfolios" ADD COLUMN "deposited_usdc_micros" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "investor_portfolios" ADD COLUMN "allocated_usdc_micros" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "investor_portfolios" ADD COLUMN "unallocated_usdc_micros" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "investor_portfolios" ADD COLUMN "realized_pnl_usdc_micros" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "investor_portfolios" ADD COLUMN "pending_deposits_usdc_micros" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "investor_portfolios" ADD COLUMN "pending_withdrawals_usdc_micros" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "investor_activity" ADD COLUMN "amount_usdc_micros" BIGINT NOT NULL DEFAULT 0;
