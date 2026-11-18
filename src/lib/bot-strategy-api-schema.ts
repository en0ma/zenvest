import {z} from "zod";
const USDC=/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
const MAX_USDC_MICROS=9223372036854775807n;
export function allocationMicros(value:string):bigint|null{
 if(!USDC.test(value))return null;
 const [whole,fraction=""]=value.split(".");
 const micros=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,"0"));
 return micros>0n&&micros<=MAX_USDC_MICROS?micros:null;
}
const positiveUsdc=z.string().refine(x=>allocationMicros(x)!==null,"Must be a positive USDC decimal with at most six places");
/** Event-market strategy configuration has NO predetermined trade side. */
export const strategyConfiguration=z.object({
 market_type:z.literal("event"),
 venue:z.literal("kalshi"),
 asset:z.string().trim().min(2).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
 min_allocation:positiveUsdc,
 max_allocation:positiveUsdc,
 strategy_id:z.string().min(1).max(64).optional()
}).strict().refine(x=>{
 const min=allocationMicros(x.min_allocation),max=allocationMicros(x.max_allocation);
 return min!==null&&max!==null&&min<=max;
},{
 message:"Minimum allocation cannot exceed maximum allocation",path:["max_allocation"]
});
export const eventTradeInput=z.object({
 order_type:z.enum(["buy","sell"]),
 trade_size:z.number().int().positive().max(1000000),
 event_id:z.string().trim().min(1).max(180).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
 side:z.enum(["up","down","yes","no"])
}).strict();
export function canonicalEventSide(side:"up"|"down"|"yes"|"no"):"yes"|"no"{
 return side==="up"||side==="yes"?"yes":"no";
}
export function canRecordBotTrade(status:string,marketType:string,venue:string|null,eventTag:string|null){
 return status==="TRADING"&&marketType==="PREDICTION"&&venue==="kalshi"&&Boolean(eventTag);
}
