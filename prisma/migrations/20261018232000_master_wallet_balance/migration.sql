CREATE TABLE "master_wallet_balances" (
 "wallet_id" TEXT NOT NULL,
 "confirmed_usdc_micros" BIGINT NOT NULL DEFAULT 0,
 "reserved_usdc_micros" BIGINT NOT NULL DEFAULT 0,
 "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "master_wallet_balances_pkey" PRIMARY KEY ("wallet_id"),
 CONSTRAINT "master_balance_nonnegative" CHECK ("confirmed_usdc_micros" >= 0 AND "reserved_usdc_micros" >= 0 AND "reserved_usdc_micros" <= "confirmed_usdc_micros")
);
