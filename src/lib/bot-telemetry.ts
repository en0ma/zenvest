export const BOT_STALE_AFTER_MS = 90_000;
/** Bot is external. Telemetry is informational, never an authority for custody or withdrawal eligibility. */
export function botFreshness(asOf: Date, now = new Date()) {
 const age = now.getTime()-asOf.getTime();
 return age >= 0 && age <= BOT_STALE_AFTER_MS ? "CURRENT" : "STALE";
}
export function usdcFromMicros(micros: bigint) {
 const negative = micros < 0n;
 const abs = negative ? -micros : micros;
 return (negative ? "-" : "") + (abs/1_000_000n).toString()+"."+((abs%1_000_000n).toString().padStart(6,"0").replace(/0+$/,"")||"00");
}
