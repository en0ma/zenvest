CREATE TABLE "portfolio_snapshots" (
 "id" TEXT NOT NULL,
 "user_id" TEXT NOT NULL,
 "snapshot_at" TIMESTAMP(3) NOT NULL,
 "unallocated_usdc_micros" BIGINT NOT NULL,
 "allocated_usdc_micros" BIGINT NOT NULL,
 "reserved_usdc_micros" BIGINT NOT NULL,
 "portfolio_value_usdc_micros" BIGINT NOT NULL,
 "cumulative_realized_pnl_usdc_micros" BIGINT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "portfolio_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "portfolio_snapshots_balances_nonnegative" CHECK ("unallocated_usdc_micros" >= 0 AND "allocated_usdc_micros" >= 0 AND "reserved_usdc_micros" >= 0),
 CONSTRAINT "portfolio_snapshots_value_sum" CHECK ("portfolio_value_usdc_micros" = "unallocated_usdc_micros" + "allocated_usdc_micros")
);
CREATE UNIQUE INDEX "portfolio_snapshots_user_id_snapshot_at_key" ON "portfolio_snapshots"("user_id","snapshot_at");
CREATE INDEX "portfolio_snapshots_snapshot_at_idx" ON "portfolio_snapshots"("snapshot_at");
