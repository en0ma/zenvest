CREATE TABLE "StaffKalshiReturnSimulation" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "staffActionId" TEXT NOT NULL,
 "strategyId" TEXT NOT NULL,
 "amountUsdcMicros" BIGINT NOT NULL,
 "masterWalletAddress" VARCHAR(180) NOT NULL,
 "mockWithdrawalId" VARCHAR(200),
 "status" VARCHAR(32) NOT NULL DEFAULT 'CLAIMED',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "staff_kalshi_simulation_positive" CHECK ("amountUsdcMicros" > 0),
 CONSTRAINT "staff_kalshi_simulation_status" CHECK ("status" IN ('CLAIMED','MOCK_ACCEPTED','SIMULATION_REVIEW'))
);
CREATE UNIQUE INDEX "StaffKalshiReturnSimulation_staffActionId_key" ON "StaffKalshiReturnSimulation"("staffActionId");
CREATE UNIQUE INDEX "StaffKalshiReturnSimulation_mockWithdrawalId_key" ON "StaffKalshiReturnSimulation"("mockWithdrawalId");
CREATE INDEX "StaffKalshiReturnSimulation_strategyId_createdAt_idx" ON "StaffKalshiReturnSimulation"("strategyId","createdAt");
