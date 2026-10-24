ALTER TYPE "WithdrawalStatus" ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TYPE "PositionTransferStatus" ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TABLE "withdrawals" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "withdrawals" ADD COLUMN "next_retry" TIMESTAMP(3);
CREATE INDEX "withdrawals_status_next_retry_idx" ON "withdrawals"("status","next_retry");
