import { WITHDRAWAL_FEE_USDC_MICROS } from "./withdrawal-fee.ts";
const MAX=9223372036854775807n;
function usdMicrosCeil(raw:unknown):bigint{
 if(typeof raw!=="string"&&typeof raw!=="number")throw new Error("Missing Blockradar USD network fee");
 const value=String(raw);
 if(!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(value))throw new Error("Invalid network fee");
 const [whole,fraction=""]=value.split(".");
 const padded=fraction.padEnd(18,"0");
 const result=BigInt(whole)*1000000n+BigInt(padded.slice(0,6))+(BigInt(padded.slice(6))>0n?1n:0n);
 if(result>MAX)throw new Error("Network fee exceeds supported amount");
 return result;
}
export function parseBlockradarNetworkFee(payload:unknown):bigint{
 if(!payload||typeof payload!=="object")throw new Error("Invalid network fee response");
 const data=(payload as Record<string,unknown>).data;
 if(!data||typeof data!=="object")throw new Error("Missing network fee data");
 const fee=(data as Record<string,unknown>).networkFeeInUSD;
 return usdMicrosCeil(fee);
}
export function withdrawalFeeBreakdown(gross:bigint,network:bigint){
 if(gross<=0n||network<0n||network>MAX-WITHDRAWAL_FEE_USDC_MICROS)throw new Error("Invalid withdrawal fee");
 const service=WITHDRAWAL_FEE_USDC_MICROS,total=service+network;
 if(gross<=total)throw new Error("Withdrawal must exceed fees");
 return {service,network,total,net:gross-total};
}
export function formatMicros(value:bigint):string{
 return (value/1000000n).toString()+"."+(value%1000000n).toString().padStart(6,"0");
}
