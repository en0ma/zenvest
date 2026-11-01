ALTER TABLE "master_wallet_balances" ADD COLUMN "fee_reserve_usdc_micros" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "master_wallet_balances" DROP CONSTRAINT "master_balance_nonnegative";
ALTER TABLE "master_wallet_balances" ADD CONSTRAINT "master_balance_nonnegative" CHECK (
 "confirmed_usdc_micros" >= 0 AND "reserved_usdc_micros" >= 0
 AND "fee_reserve_usdc_micros" >= 0
 AND "reserved_usdc_micros" + "fee_reserve_usdc_micros" <= "confirmed_usdc_micros"
);
