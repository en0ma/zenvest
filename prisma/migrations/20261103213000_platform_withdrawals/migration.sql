CREATE TYPE "PlatformWithdrawalStatus" AS ENUM ('PENDING','SUBMITTING','PROCESSING','REVIEW','COMPLETED','FAILED','CANCELLED');
CREATE TABLE "PlatformWithdrawal" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "staffActionId" TEXT NOT NULL,
 "destinationAddress" VARCHAR(128) NOT NULL,
 "amountUsdcMicros" BIGINT NOT NULL,
 "reservedMBankMicros" BIGINT NOT NULL DEFAULT 0,
 "reservedDepositFeeMicros" BIGINT NOT NULL DEFAULT 0,
 "reservedWithdrawalFeeMicros" BIGINT NOT NULL DEFAULT 0,
 "status" "PlatformWithdrawalStatus" NOT NULL DEFAULT 'PENDING',
 "providerTransactionId" VARCHAR(180),
 "transactionHash" VARCHAR(180),
 "failureCode" VARCHAR(100),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 "completedAt" TIMESTAMP(3),
 CONSTRAINT "platform_withdrawal_positive_amount" CHECK ("amountUsdcMicros">0),
 CONSTRAINT "platform_withdrawal_nonnegative_reserves" CHECK ("reservedMBankMicros">=0 AND "reservedDepositFeeMicros">=0 AND "reservedWithdrawalFeeMicros">=0),
 CONSTRAINT "platform_withdrawal_exact_reservation" CHECK ("reservedMBankMicros"+"reservedDepositFeeMicros"+"reservedWithdrawalFeeMicros"="amountUsdcMicros")
);
CREATE UNIQUE INDEX "PlatformWithdrawal_staffActionId_key" ON "PlatformWithdrawal"("staffActionId");
CREATE UNIQUE INDEX "PlatformWithdrawal_providerTransactionId_key" ON "PlatformWithdrawal"("providerTransactionId");
CREATE INDEX "PlatformWithdrawal_status_createdAt_idx" ON "PlatformWithdrawal"("status","createdAt");
