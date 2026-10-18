CREATE TYPE "BlockchainDepositStatus" AS ENUM ('CONFIRMING', 'CONFIRMED');
ALTER TABLE "blockchain_deposits" ADD COLUMN "status" "BlockchainDepositStatus" NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE "blockchain_deposits" ADD COLUMN "sweep_hash" VARCHAR(180);
ALTER TABLE "blockchain_deposits" ALTER COLUMN "status" SET DEFAULT 'CONFIRMING';
-- Historical deposits were already credited under the old accounting model:
-- preserve them as CONFIRMED, never apply a second ledger credit.
