CREATE TABLE "webhook_dead_later" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "kind" VARCHAR(32) NOT NULL,
 "user_id" TEXT NOT NULL,
 "reference" VARCHAR(180) NOT NULL,
 "provider_transaction_id" VARCHAR(180) NOT NULL,
 "payload" JSONB NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "webhook_dead_later_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "webhook_dead_later_kind_reference_provider_transaction_id_key" ON "webhook_dead_later"("kind","reference","provider_transaction_id");
CREATE INDEX "webhook_dead_later_user_id_created_at_idx" ON "webhook_dead_later"("user_id","created_at");
