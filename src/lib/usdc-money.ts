/** Investor balances use integer USDC micros (1 USDC = 1,000,000 micros). */
export function formatUsdc(amount: bigint): string {
 const negative=amount<0n;
 const abs=negative?-amount:amount;
 const whole=abs/1_000_000n;
 const fraction=(abs%1_000_000n).toString().padStart(6,"0").slice(0,2);
 const grouped=whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g,",");
 return (negative?"−":"")+"$"+grouped+"."+fraction+" USDC";
}
