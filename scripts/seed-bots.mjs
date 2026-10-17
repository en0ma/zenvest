/**
 * Optional idempotent development/demo seed. Run with: npm run db:seed:bots
 * Never overwrites an existing bot or trade snapshot.
 * The seeded row is deliberately stale, OFFLINE and has zero inventory/cost.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const botId = process.env.ZENVEST_SEED_BOT_ID?.trim() || "sample-bot";
if (!/^[A-Za-z0-9_-]{1,64}$/.test(botId)) throw new Error("Invalid ZENVEST_SEED_BOT_ID");
try {
  const existing = await prisma.bot.findUnique({where:{id:botId}});
  if (!existing) {
    await prisma.bot.create({data:{
      id:botId,
      name:"Sample Bot",
      description:"Example registration for a Python-managed 15-minute Kalshi trading bot. Not a live trading bot."
    }});
  }
  const snapshot = await prisma.activeBotTrade.findUnique({where:{botId}});
  if (!snapshot) {
    await prisma.activeBotTrade.create({data:{
      botId, status:"OFFLINE", eventTicker:null,
      yesContracts:0, noContracts:0,
      yesCostUsdcMicros:0n, noCostUsdcMicros:0n,
      asOf:new Date("2020-01-01T00:00:00.000Z")
    }});
  }
  console.log("Bot registry and inactive sample snapshot seeded:",botId);
} finally {
  await prisma.$disconnect();
}
