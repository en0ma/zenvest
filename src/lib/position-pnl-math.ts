// Pure signed integer micro-USDC allocator; no floats or mutable position balances.
export type CapitalWeight={id:string;eligibleCapitalUsdcMicros:bigint};
export function distributeWeightedMicros(amount:bigint, rows:CapitalWeight[]):Map<string,bigint>{
 const total=rows.reduce((n,r)=>n+r.eligibleCapitalUsdcMicros,0n);
 if(total<=0n||rows.some(r=>r.eligibleCapitalUsdcMicros<=0n))throw new Error("Invalid eligible investor exposure");
 const ids=new Set(rows.map(x=>x.id));if(ids.size!==rows.length)throw new Error("Duplicate position exposure");
 const abs=amount<0n?-amount:amount,sign=amount<0n?-1n:1n;
 const items=rows.map(r=>({id:r.id,base:abs*r.eligibleCapitalUsdcMicros/total,
  remainder:abs*r.eligibleCapitalUsdcMicros%total}));
 let outstanding=abs-items.reduce((sum,row)=>sum+row.base,0n);
 items.sort((a,b)=>a.remainder===b.remainder?a.id.localeCompare(b.id):a.remainder>b.remainder?-1:1);
 for(const item of items){if(outstanding<=0n)break;item.base++;outstanding--;}
 if(outstanding!==0n)throw new Error("Unallocated rounding remainder");
 return new Map(items.map(x=>[x.id,sign*x.base]));
}
export function platformProfitFee(gross:bigint,percentageFourDecimals:string):bigint{
 if(!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(percentageFourDecimals))throw new Error("Invalid platform fee rate");
 const [whole,decimal=""]=percentageFourDecimals.split(".");
 const units=BigInt(whole)*10000n+BigInt(decimal.padEnd(4,"0"));
 if(units>1000000n)throw new Error("Platform fee exceeds 100 percent");
 return gross>0n?gross*units/1000000n:0n;
}
