-- Positions own their principal; pending funding is a reservation, not an allocated balance.
ALTER TABLE "investor_portfolios" ADD COLUMN "pending_allocations_usdc_micros" BIGINT NOT NULL DEFAULT 0;
CREATE TYPE "PositionStatus" AS ENUM ('PENDING', 'ACTIVE', 'CLOSED');
CREATE TYPE "PositionOperationType" AS ENUM ('ALLOCATE', 'DEALLOCATE');
CREATE TYPE "PositionOperationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVIEW');
CREATE TABLE "investor_positions" (
  "id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "portfolio_id" TEXT NOT NULL,
  "principal_usdc_micros" BIGINT NOT NULL DEFAULT 0,
  "realized_pnl_usdc_micros" BIGINT NOT NULL DEFAULT 0,
  "status" "PositionStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "closed_at" TIMESTAMP(3),
  CONSTRAINT "investor_positions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "position_operations" (
  "id" TEXT NOT NULL, "position_id" TEXT NOT NULL, "user_id" TEXT NOT NULL,
  "portfolio_id" TEXT NOT NULL, "type" "PositionOperationType" NOT NULL,
  "status" "PositionOperationStatus" NOT NULL DEFAULT 'PENDING',
  "amount_usdc_micros" BIGINT NOT NULL, "settled_usdc_micros" BIGINT,
  "provider_reference" VARCHAR(180),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, "completed_at" TIMESTAMP(3),
  CONSTRAINT "position_operations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "position_operations_provider_reference_key" ON "position_operations"("provider_reference");
CREATE INDEX "investor_positions_user_id_status_created_at_idx" ON "investor_positions"("user_id", "status", "created_at");
CREATE INDEX "position_operations_user_id_created_at_idx" ON "position_operations"("user_id", "created_at");
CREATE INDEX "position_operations_position_id_status_idx" ON "position_operations"("position_id", "status");
CREATE INDEX "position_operations_status_created_at_idx" ON "position_operations"("status", "created_at");
ALTER TABLE "investor_positions" ADD CONSTRAINT "investor_positions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "investor_positions" ADD CONSTRAINT "investor_positions_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "investor_portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_operations" ADD CONSTRAINT "position_operations_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "investor_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_operations" ADD CONSTRAINT "position_operations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_operations" ADD CONSTRAINT "position_operations_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "investor_portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
