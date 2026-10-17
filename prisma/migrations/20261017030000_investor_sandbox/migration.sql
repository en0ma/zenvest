CREATE TABLE "investor_portfolios" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "mode" VARCHAR(16) NOT NULL DEFAULT 'SANDBOX',
  "deposited_kobo" BIGINT NOT NULL DEFAULT 0,
  "allocated_kobo" BIGINT NOT NULL DEFAULT 0,
  "unallocated_kobo" BIGINT NOT NULL DEFAULT 0,
  "realized_pnl_kobo" BIGINT NOT NULL DEFAULT 0,
  "pending_deposits_kobo" BIGINT NOT NULL DEFAULT 0,
  "pending_withdrawals_kobo" BIGINT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "investor_portfolios_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "investor_portfolios_user_id_key" ON "investor_portfolios"("user_id");
ALTER TABLE "investor_portfolios" ADD CONSTRAINT "investor_portfolios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
