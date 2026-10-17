/**
 * Idempotent demo seed executed after production migrations.
 * Never overwrites an existing real bot snapshot or a Python bot update.
 * Example amounts are simulated and must not be presented as live trades.
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
      botId, status:"MONITORING", eventTicker:"DEMO-BTC-15M",
      yesContracts:42, noContracts:27,
      yesCostUsdcMicros:12_600_000n, noCostUsdcMicros:8_100_000n,
      asOf:new Date("2020-01-01T00:00:00.000Z")
    }});
  }
  console.log("Demo bot and simulated active inventory seeded if absent:",botId);
} finally {
  await prisma.$disconnect();
}
