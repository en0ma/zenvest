-- Prelaunch: old lifecycle values do not need preserving.
ALTER TABLE "withdrawals" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "WithdrawalStatus" RENAME TO "WithdrawalStatus_old";
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING','SUBMITTING','PROCESSING','COMPLETED','FAILED','CANCELLED');
ALTER TABLE "withdrawals" ALTER COLUMN "status" TYPE "WithdrawalStatus" USING (
  CASE WHEN "status"::text='SUCCESS' THEN 'COMPLETED'
       WHEN "status"::text='REVIEW' THEN 'PROCESSING'
       WHEN "status"::text='REQUESTED' THEN 'PENDING'
       ELSE "status"::text END
)::"WithdrawalStatus";
ALTER TABLE "withdrawals" ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "WithdrawalStatus_old";

ALTER TYPE "PositionTransferStatus" RENAME TO "PositionTransferStatus_old";
CREATE TYPE "PositionTransferStatus" AS ENUM ('PENDING','SUBMITTING','PROCESSING','COMPLETED','FAILED','CANCELLED');
ALTER TABLE "position_allocations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "position_deallocations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "position_allocations" ALTER COLUMN "status" TYPE "PositionTransferStatus" USING (
 CASE WHEN "status"::text='ALLOCATED' THEN 'COMPLETED'
      WHEN "status"::text='REVIEW' THEN 'PROCESSING'
      WHEN "status"::text='ALLOCATING' THEN 'PROCESSING'
      WHEN "status"::text='DEALLOCATING' THEN 'PROCESSING'
      WHEN "status"::text='DEALLOCATED' THEN 'COMPLETED'
      ELSE "status"::text END
)::"PositionTransferStatus";
ALTER TABLE "position_deallocations" ALTER COLUMN "status" TYPE "PositionTransferStatus" USING (
 CASE WHEN "status"::text IN ('ALLOCATED','DEALLOCATED') THEN 'COMPLETED'
      WHEN "status"::text IN ('REVIEW','ALLOCATING','DEALLOCATING') THEN 'PROCESSING'
      ELSE "status"::text END
)::"PositionTransferStatus";
ALTER TABLE "position_allocations" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "position_deallocations" ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "PositionTransferStatus_old";
