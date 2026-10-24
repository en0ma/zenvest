-- A single verified Kalshi credit must not finalize multiple allocation transfers.
CREATE UNIQUE INDEX "treasury_transactions_allocate_destination_receipt_unique"
ON "treasury_transactions" ("destination_external_id")
WHERE "direction" = 'ALLOCATE' AND "destination_external_id" IS NOT NULL;
