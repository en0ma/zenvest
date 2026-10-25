CREATE TYPE "RecipientKind" AS ENUM ('WITHDRAW', 'SEND');
CREATE TYPE "RecipientStatus" AS ENUM ('PENDING', 'COMPLETED');
CREATE TYPE "SendStatus" AS ENUM ('PENDING', 'COMPLETED');

CREATE TABLE "user_recipients" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "kind" "RecipientKind" NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "handle" VARCHAR(8),
  "wallet_address" VARCHAR(128),
  "network" VARCHAR(32),
  "status" "RecipientStatus" NOT NULL DEFAULT 'COMPLETED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_recipients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "user_recipients_destination_check" CHECK (
    ("kind" = 'SEND' AND "handle" IS NOT NULL AND "wallet_address" IS NULL AND "network" IS NULL)
    OR ("kind" = 'WITHDRAW' AND "wallet_address" IS NOT NULL AND "network" IS NOT NULL AND "handle" IS NULL)
  )
);
CREATE INDEX "user_recipients_user_id_kind_created_at_idx" ON "user_recipients"("user_id","kind","created_at");

CREATE TABLE "sends" (
  "id" TEXT NOT NULL,
  "status" "SendStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sender_user_id" TEXT NOT NULL,
  "recipient_user_id" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "sender_handle" VARCHAR(8) NOT NULL,
  "recipient_handle" VARCHAR(8) NOT NULL,
  "request_key" VARCHAR(100) NOT NULL,
  CONSTRAINT "sends_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sends_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sends_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sends_positive_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "sends_not_self_check" CHECK ("sender_user_id" <> "recipient_user_id")
);
CREATE UNIQUE INDEX "sends_request_key_key" ON "sends"("request_key");
CREATE INDEX "sends_sender_user_id_created_at_idx" ON "sends"("sender_user_id","created_at");
CREATE INDEX "sends_recipient_user_id_created_at_idx" ON "sends"("recipient_user_id","created_at");
