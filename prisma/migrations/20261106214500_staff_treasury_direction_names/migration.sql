-- New explicit staff treasury transaction directions. No balance or historical
-- row conversion is needed in the current empty environment. Legacy directions
-- remain accepted by PostgreSQL but are not emitted by the application.
ALTER TYPE "TreasuryDirection" ADD VALUE IF NOT EXISTS 'K_BANK_DEPOSIT';
ALTER TYPE "TreasuryDirection" ADD VALUE IF NOT EXISTS 'K_BANK_WITHDRAWAL';
ALTER TYPE "TreasuryDirection" ADD VALUE IF NOT EXISTS 'M_BANK_DEPOSIT';
ALTER TYPE "TreasuryDirection" ADD VALUE IF NOT EXISTS 'M_BANK_WITHDRAWAL';
