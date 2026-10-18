ALTER TABLE "investor_withdrawals" ADD COLUMN "idempotency_key" VARCHAR(64);
UPDATE "investor_withdrawals" SET "idempotency_key" = "id";
ALTER TABLE "investor_withdrawals" ALTER COLUMN "idempotency_key" SET NOT NULL;
CREATE UNIQUE INDEX "investor_withdrawals_user_id_idempotency_key_key" ON "investor_withdrawals"("user_id", "idempotency_key");
