import test from "node:test";
import assert from "node:assert/strict";
import { botFreshness, usdcFromMicros } from "../src/lib/bot-telemetry.ts";
test("status timestamps expire after 90 seconds", () => {
 const now = new Date("2026-10-17T15:00:00.000Z");
 assert.equal(botFreshness(new Date(now.getTime()-90_000),now),"CURRENT");
 assert.equal(botFreshness(new Date(now.getTime()-90_001),now),"STALE");
 assert.equal(botFreshness(new Date(now.getTime()+10_000),now),"STALE");
});
test("exact integer USDC formatting supports negative amounts", () => {
 assert.equal(usdcFromMicros(1234567n),"1.234567");
 assert.equal(usdcFromMicros(-1000000n),"-1.00");
 assert.equal(usdcFromMicros(0n),"0.00");
});
