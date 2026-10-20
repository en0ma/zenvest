-- Pending requests reserve unallocated capital without moving custody or recognizing funding.
ALTER TABLE "investor_portfolios" ADD COLUMN "pending_allocations_usdc_micros" BIGINT NOT NULL DEFAULT 0;
CREATE TYPE "PositionStatus" AS ENUM ('PENDING','ACTIVE','CLOSED');
CREATE TYPE "PositionTransferStatus" AS ENUM ('PENDING','ALLOCATING','DEALLOCATING','DONE','FAILED','REVIEW');
CREATE TABLE "positions" (
 "id" TEXT NOT NULL PRIMARY KEY, "user_id" TEXT NOT NULL, "portfolio_id" TEXT NOT NULL,
 "principal_usdc_micros" BIGINT NOT NULL DEFAULT 0,
 "realized_pnl_usdc_micros" BIGINT NOT NULL DEFAULT 0,
 "status" "PositionStatus" NOT NULL DEFAULT 'PENDING',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,
 "closed_at" TIMESTAMP(3)
);
CREATE TABLE "position_allocations" (
 "id" TEXT NOT NULL PRIMARY KEY,"position_id" TEXT NOT NULL,"user_id" TEXT NOT NULL,"portfolio_id" TEXT NOT NULL,
 "amount_usdc_micros" BIGINT NOT NULL,"status" "PositionTransferStatus" NOT NULL DEFAULT 'PENDING',
 "request_key" VARCHAR(180) NOT NULL,"provider_reference" VARCHAR(180),
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,"completed_at" TIMESTAMP(3)
);
CREATE TABLE "position_deallocations" (
 "id" TEXT NOT NULL PRIMARY KEY,"position_id" TEXT NOT NULL,"user_id" TEXT NOT NULL,"portfolio_id" TEXT NOT NULL,
 "amount_usdc_micros" BIGINT NOT NULL,"settled_usdc_micros" BIGINT,
 "status" "PositionTransferStatus" NOT NULL DEFAULT 'PENDING',
 "request_key" VARCHAR(180) NOT NULL,"provider_reference" VARCHAR(180),
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,"completed_at" TIMESTAMP(3)
);
CREATE INDEX "positions_user_id_status_created_at_idx" ON "positions"("user_id","status","created_at");
CREATE UNIQUE INDEX "position_allocations_request_key_key" ON "position_allocations"("request_key");
CREATE UNIQUE INDEX "position_allocations_provider_reference_key" ON "position_allocations"("provider_reference");
CREATE INDEX "position_allocations_user_id_created_at_idx" ON "position_allocations"("user_id","created_at");
CREATE INDEX "position_allocations_status_created_at_idx" ON "position_allocations"("status","created_at");
CREATE UNIQUE INDEX "position_deallocations_request_key_key" ON "position_deallocations"("request_key");
CREATE UNIQUE INDEX "position_deallocations_provider_reference_key" ON "position_deallocations"("provider_reference");
CREATE INDEX "position_deallocations_user_id_created_at_idx" ON "position_deallocations"("user_id","created_at");
CREATE INDEX "position_deallocations_position_id_status_idx" ON "position_deallocations"("position_id","status");
CREATE INDEX "position_deallocations_status_created_at_idx" ON "position_deallocations"("status","created_at");
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "positions" ADD CONSTRAINT "positions_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "investor_portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_allocations" ADD CONSTRAINT "position_allocations_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_allocations" ADD CONSTRAINT "position_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_allocations" ADD CONSTRAINT "position_allocations_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "investor_portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_deallocations" ADD CONSTRAINT "position_deallocations_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_deallocations" ADD CONSTRAINT "position_deallocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_deallocations" ADD CONSTRAINT "position_deallocations_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "investor_portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "TreasuryDirection" AS ENUM ('ALLOCATE','DEALLOCATE','PAYOUT');
CREATE TYPE "TreasuryStatus" AS ENUM ('PENDING','PROCESSING','COMPLETE','FAILED','REVIEW');
CREATE TABLE "treasury" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "direction" "TreasuryDirection" NOT NULL,
 "status" "TreasuryStatus" NOT NULL DEFAULT 'PENDING',
 "asset_id" VARCHAR(180),
 "asset" VARCHAR(16) NOT NULL DEFAULT 'USDC',
 "amount_usdc_micros" BIGINT NOT NULL,
 "fee_usdc_micros" BIGINT NOT NULL DEFAULT 0,
 "destination_wallet_address" VARCHAR(180) NOT NULL,
 "network" VARCHAR(32) NOT NULL DEFAULT 'solana',
 "master_wallet_address" VARCHAR(180) NOT NULL,
 "master_wallet_id" VARCHAR(180) NOT NULL,
 "origin_external_id" VARCHAR(180),
 "destination_external_id" VARCHAR(180),
 "reference" VARCHAR(180) NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,
 "completed_at" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "treasury_reference_key" ON "treasury"("reference");
CREATE INDEX "treasury_direction_status_created_at_idx" ON "treasury"("direction","status","created_at");
CREATE INDEX "treasury_origin_external_id_idx" ON "treasury"("origin_external_id");
CREATE INDEX "treasury_destination_external_id_idx" ON "treasury"("destination_external_id");
ALTER TABLE "investor_withdrawals" ADD COLUMN "treasury_id" TEXT;
ALTER TABLE "position_allocations" ADD COLUMN "treasury_id" TEXT;
ALTER TABLE "position_deallocations" ADD COLUMN "treasury_id" TEXT;
CREATE INDEX "investor_withdrawals_treasury_id_idx" ON "investor_withdrawals"("treasury_id");
CREATE INDEX "position_allocations_treasury_id_idx" ON "position_allocations"("treasury_id");
CREATE INDEX "position_deallocations_treasury_id_idx" ON "position_deallocations"("treasury_id");
ALTER TABLE "investor_withdrawals" ADD CONSTRAINT "investor_withdrawals_treasury_id_fkey" FOREIGN KEY ("treasury_id") REFERENCES "treasury"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_allocations" ADD CONSTRAINT "position_allocations_treasury_id_fkey" FOREIGN KEY ("treasury_id") REFERENCES "treasury"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_deallocations" ADD CONSTRAINT "position_deallocations_treasury_id_fkey" FOREIGN KEY ("treasury_id") REFERENCES "treasury"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
