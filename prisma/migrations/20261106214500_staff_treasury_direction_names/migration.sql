-- This PR is not merged and the environment has no historical treasury data.
-- Replace PostgreSQL's enum (DROP VALUE is unsupported). Abort instead of
-- silently deleting/reinterpreting financial history if old labels do exist.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM "treasury_transactions"
            WHERE "direction"::text IN ('PLATFORM_PULL','PLATFORM_M_BANK','PLATFORM_K_BANK')) THEN
  RAISE EXCEPTION 'Legacy PLATFORM_* treasury entries need manual reconciliation before enum removal';
 END IF;
END $$;

-- Preserve the allocation-receipt uniqueness invariant: its partial-index
-- predicate compares the old enum and must be rebuilt after type replacement.
DROP INDEX "treasury_transactions_allocate_destination_receipt_unique";

CREATE TYPE "TreasuryDirection_clean" AS ENUM (
 'DEPOSIT','ALLOCATE','DEALLOCATE','WITHDRAWAL',
 'K_BANK_DEPOSIT','K_BANK_WITHDRAWAL','M_BANK_DEPOSIT','M_BANK_WITHDRAWAL'
);
ALTER TABLE "treasury_transactions" ALTER COLUMN "direction"
 TYPE "TreasuryDirection_clean" USING ("direction"::text::"TreasuryDirection_clean");
DROP TYPE "TreasuryDirection";
ALTER TYPE "TreasuryDirection_clean" RENAME TO "TreasuryDirection";

-- Restore the same unique constraint after enum recreation.
CREATE UNIQUE INDEX "treasury_transactions_allocate_destination_receipt_unique"
ON "treasury_transactions" ("destination_external_id")
WHERE "direction" = 'ALLOCATE' AND "destination_external_id" IS NOT NULL;
