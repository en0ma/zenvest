-- Retain existing withdrawal treasury associations without copying IDs.
ALTER TABLE "withdrawals" RENAME COLUMN "treasury_id" TO "treasury_transaction_id";
ALTER INDEX IF EXISTS "withdrawals_treasury_id_idx" RENAME TO "withdrawals_treasury_transaction_id_idx";
ALTER TABLE "deposits" ADD COLUMN "treasury_transaction_id" TEXT;
-- Existing CONFIRMED deposits may predate the relationship. Match only the
-- immutable provider transaction reference and a COMPLETE deposit ledger row.
UPDATE "deposits" AS d
 SET "treasury_transaction_id" = t."id"
 FROM "treasury_transactions" AS t
 WHERE d."provider_transaction_id" = t."reference"
   AND d."status" = 'CONFIRMED'
   AND t."direction" = 'DEPOSIT'
   AND t."status" = 'COMPLETE';
CREATE UNIQUE INDEX "deposits_treasury_transaction_id_key" ON "deposits"("treasury_transaction_id");
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_treasury_transaction_id_fkey"
 FOREIGN KEY ("treasury_transaction_id") REFERENCES "treasury_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
