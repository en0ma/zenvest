ALTER TABLE "TwoFactor" ADD COLUMN "email_enabled" BOOLEAN NOT NULL DEFAULT false;
UPDATE "TwoFactor" SET "email_enabled" = true WHERE "method" = 'EMAIL';
