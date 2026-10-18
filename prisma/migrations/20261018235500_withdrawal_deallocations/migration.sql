CREATE TYPE "DeallocationStatus" AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED');
CREATE TABLE "withdrawal_deallocations" (
"id" TEXT NOT NULL,
"withdrawal_id" TEXT NOT NULL,
"user_id" TEXT NOT NULL,
"portfolio_id" TEXT NOT NULL,
"amount_usdc_micros" BIGINT NOT NULL,
"status" "DeallocationStatus" NOT NULL DEFAULT 'PENDING',
"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updated_at" TIMESTAMP(3) NOT NULL,
"completed_at" TIMESTAMP(3),
CONSTRAINT "withdrawal_deallocations_pkey" PRIMARY KEY ("id"),
CONSTRAINT "withdrawal_deallocations_positive" CHECK ("amount_usdc_micros" > 0)
);
CREATE UNIQUE INDEX "withdrawal_deallocations_withdrawal_id_key" ON "withdrawal_deallocations"("withdrawal_id");
CREATE INDEX "withdrawal_deallocations_status_created_at_idx" ON "withdrawal_deallocations"("status","created_at");
ALTER TABLE "withdrawal_deallocations" ADD CONSTRAINT "withdrawal_deallocations_withdrawal_id_fkey" FOREIGN KEY ("withdrawal_id") REFERENCES "investor_withdrawals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "withdrawal_deallocations" ADD CONSTRAINT "withdrawal_deallocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "withdrawal_deallocations" ADD CONSTRAINT "withdrawal_deallocations_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "investor_portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
