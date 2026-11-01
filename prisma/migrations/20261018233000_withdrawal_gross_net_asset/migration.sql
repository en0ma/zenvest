ALTER TABLE "investor_withdrawals" ADD COLUMN "gross_usdc_micros" BIGINT;
ALTER TABLE "investor_withdrawals" ADD COLUMN "asset" VARCHAR(16) NOT NULL DEFAULT 'USDC';
UPDATE "investor_withdrawals" SET "gross_usdc_micros" = "amount_usdc_micros" + "fee_usdc_micros";
ALTER TABLE "investor_withdrawals" ALTER COLUMN "gross_usdc_micros" SET NOT NULL;
ALTER TABLE "investor_withdrawals" ADD CONSTRAINT "withdrawal_gross_net_fee" CHECK (
 "gross_usdc_micros" = "amount_usdc_micros" + "fee_usdc_micros"
 AND "amount_usdc_micros" > 0 AND "fee_usdc_micros" >= 0
);
