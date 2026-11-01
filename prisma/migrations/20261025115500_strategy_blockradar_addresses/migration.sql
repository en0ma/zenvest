ALTER TABLE "strategies" ADD COLUMN "block_radar_address" VARCHAR(128);
ALTER TABLE "strategies" ADD COLUMN "block_radar_address_id" VARCHAR(160);
CREATE UNIQUE INDEX "strategies_block_radar_address_key" ON "strategies"("block_radar_address");
CREATE UNIQUE INDEX "strategies_block_radar_address_id_key" ON "strategies"("block_radar_address_id");
