ALTER TABLE "strategies" ADD COLUMN "venue_verified_at" TIMESTAMP(3);
ALTER TABLE "strategies" ADD COLUMN "custody_verified_at" TIMESTAMP(3);
-- These fields intentionally remain NULL until a separate authenticated
-- provider verification flow proves each strategy's venue and custody identity.
