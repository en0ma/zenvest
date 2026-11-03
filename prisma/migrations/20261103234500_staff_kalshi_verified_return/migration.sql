-- Kalshi withdrawal confirmation is distinct from mocked submission.
-- Only verified external withdrawal and verified Blockradar master sweep can settle.
ALTER TABLE "StaffKalshiReturnSimulation"
 ADD COLUMN "sourceConfirmed" BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN "destinationConfirmed" BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN "masterReceiptId" VARCHAR(180),
 ADD COLUMN "treasuryTransactionId" TEXT;
CREATE UNIQUE INDEX "StaffKalshiReturnSimulation_masterReceiptId_key" ON "StaffKalshiReturnSimulation"("masterReceiptId");
CREATE UNIQUE INDEX "StaffKalshiReturnSimulation_treasuryTransactionId_key" ON "StaffKalshiReturnSimulation"("treasuryTransactionId");
ALTER TABLE "StaffKalshiReturnSimulation"
 ADD CONSTRAINT "staff_kalshi_return_completed_proven"
 CHECK ("status" <> 'COMPLETED' OR ("sourceConfirmed" AND "destinationConfirmed" AND "masterReceiptId" IS NOT NULL AND "treasuryTransactionId" IS NOT NULL));
ALTER TABLE "StaffKalshiReturnSimulation"
 DROP CONSTRAINT "staff_kalshi_withdrawal_status";
ALTER TABLE "StaffKalshiReturnSimulation"
 ADD CONSTRAINT "staff_kalshi_withdrawal_status"
 CHECK ("status" IN ('SUBMITTING','PROCESSING','CONFIRMING','REVIEW','COMPLETED'));
