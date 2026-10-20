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
