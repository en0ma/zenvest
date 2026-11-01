-- Persist one Blockradar Solana deposit address per investor.
CREATE TYPE "DepositWalletStatus" AS ENUM ('CREATING', 'ACTIVE', 'ERROR');

CREATE TABLE "investor_deposit_wallets" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'BLOCKRADAR',
  "network" TEXT NOT NULL DEFAULT 'solana',
  "master_wallet_id" TEXT NOT NULL,
  "address_id" TEXT,
  "address" VARCHAR(128),
  "status" "DepositWalletStatus" NOT NULL DEFAULT 'CREATING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "investor_deposit_wallets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "investor_deposit_wallets_user_id_key" ON "investor_deposit_wallets"("user_id");
CREATE UNIQUE INDEX "investor_deposit_wallets_address_id_key" ON "investor_deposit_wallets"("address_id");
CREATE UNIQUE INDEX "investor_deposit_wallets_address_key" ON "investor_deposit_wallets"("address");
ALTER TABLE "investor_deposit_wallets" ADD CONSTRAINT "investor_deposit_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "blockchain_deposits" (
  "id" TEXT NOT NULL,
  "wallet_id" TEXT NOT NULL,
  "provider_transaction_id" TEXT NOT NULL,
  "transaction_hash" VARCHAR(180) NOT NULL,
  "asset_address" VARCHAR(128) NOT NULL,
  "amount_usdc_micros" BIGINT NOT NULL,
  "credited_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blockchain_deposits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "blockchain_deposits_provider_transaction_id_key" ON "blockchain_deposits"("provider_transaction_id");
CREATE INDEX "blockchain_deposits_wallet_id_created_at_idx" ON "blockchain_deposits"("wallet_id", "created_at");
ALTER TABLE "blockchain_deposits" ADD CONSTRAINT "blockchain_deposits_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "investor_deposit_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
