export function formatKobo(amount: bigint): string {
 const negative=amount<0n;
 const abs=negative?-amount:amount;
 const whole=abs/100n;
 const fraction=(abs%100n).toString().padStart(2,"0");
 const grouped=whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g,",");
 return (negative?"−":"")+"₦"+grouped+"."+fraction;
}
