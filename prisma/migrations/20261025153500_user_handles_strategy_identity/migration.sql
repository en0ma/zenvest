ALTER TABLE "users" ADD COLUMN "handle" VARCHAR(8);
-- Stable unique fallback for existing accounts; registration supplies chosen handles.
WITH numbered AS (
 SELECT id, row_number() OVER (ORDER BY id) AS ordinal FROM "users"
)
UPDATE "users" AS u SET handle = 'u' || lpad(to_hex(numbered.ordinal::integer), 7, '0')
FROM numbered WHERE u.id = numbered.id;
ALTER TABLE "users" ALTER COLUMN "handle" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_handle_format" CHECK (handle ~ '^[a-z0-9]{1,8}$');
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");
ALTER TABLE "strategies" ADD COLUMN "symbol" VARCHAR(8), ADD COLUMN "logo" VARCHAR(500);
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_symbol_format" CHECK (symbol IS NULL OR symbol ~ '^[A-Za-z0-9]{1,8}$');
CREATE UNIQUE INDEX "strategies_symbol_key" ON "strategies"("symbol");
