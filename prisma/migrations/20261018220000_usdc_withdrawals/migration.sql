CREATE TYPE "WithdrawalStatus" AS ENUM ('REQUESTED', 'SUBMITTING', 'PENDING', 'COMPLETED', 'FAILED', 'REVIEW');

CREATE TABLE "investor_withdrawals" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "portfolio_id" TEXT NOT NULL,
  "amount_usdc_micros" BIGINT NOT NULL,
  "destination_address" VARCHAR(128) NOT NULL,
  "status" "WithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
  "provider_transaction_id" VARCHAR(180),
  "transaction_hash" VARCHAR(180),
  "failure_code" VARCHAR(100),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "investor_withdrawals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "investor_withdrawals_amount_positive" CHECK ("amount_usdc_micros" > 0)
);
CREATE UNIQUE INDEX "investor_withdrawals_provider_transaction_id_key" ON "investor_withdrawals"("provider_transaction_id");
CREATE INDEX "investor_withdrawals_user_id_created_at_idx" ON "investor_withdrawals"("user_id", "created_at");
CREATE INDEX "investor_withdrawals_status_created_at_idx" ON "investor_withdrawals"("status", "created_at");
ALTER TABLE "investor_withdrawals" ADD CONSTRAINT "investor_withdrawals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "investor_withdrawals" ADD CONSTRAINT "investor_withdrawals_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "investor_portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
