/** All bigint amounts are USDC micros. No floating-point arithmetic. */
export function withdrawalSplit(gross:bigint,net:bigint,fee:bigint) {
 if(gross<=0n||net<=0n||fee<0n||net+fee!==gross)throw new Error("Withdrawal amount and fee mismatch");
 return {gross,net,fee};
}
/** Exact share in micro-USDC, rounded down to prevent overstating platform revenue.
 * Percentage in 1/10_000th percentage points (100%=1_000_000).
 */
export function platformShareMicros(profit:bigint,percentageUnits:bigint){
 if(percentageUnits<0n||percentageUnits>1_000_000n)throw new Error("Invalid platform percentage");
 if(profit<=0n)return 0n;
 return profit*percentageUnits/1_000_000n;
}
export function availablePlatformBank(confirmed:bigint,outstanding:bigint){
 if(confirmed<0n||outstanding<0n)throw new Error("Negative bank or reservation");
 return confirmed>outstanding?confirmed-outstanding:0n;
}
