-- The mock adapter still powers investor deallocation, but admin requests
-- use normal withdrawal PROCESSING/REVIEW lifecycle semantics.
ALTER TABLE "StaffKalshiReturnSimulation"
 DROP CONSTRAINT "staff_kalshi_simulation_status";
ALTER TABLE "StaffKalshiReturnSimulation"
 ALTER COLUMN "status" SET DEFAULT 'SUBMITTING';
UPDATE "StaffKalshiReturnSimulation" SET "status"='PROCESSING' WHERE "status"='MOCK_ACCEPTED';
UPDATE "StaffKalshiReturnSimulation" SET "status"='REVIEW' WHERE "status"='SIMULATION_REVIEW';
UPDATE "StaffKalshiReturnSimulation" SET "status"='SUBMITTING' WHERE "status"='CLAIMED';
ALTER TABLE "StaffKalshiReturnSimulation"
 ADD CONSTRAINT "staff_kalshi_withdrawal_status"
 CHECK ("status" IN ('SUBMITTING','PROCESSING','REVIEW'));
