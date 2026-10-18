ALTER TABLE "investor_withdrawals" ADD COLUMN "fee_usdc_micros" BIGINT NOT NULL DEFAULT 2000000;
ALTER TABLE "investor_withdrawals" ADD CONSTRAINT "investor_withdrawals_fee_nonnegative" CHECK ("fee_usdc_micros" >= 0);
