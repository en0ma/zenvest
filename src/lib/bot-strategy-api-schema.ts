import {z} from "zod";

/** v1 deliberately supports only event/prediction markets at Kalshi. */
export const strategyConfiguration=z.object({
 market_type:z.literal("event"),
 venue:z.literal("kalshi"),
 asset:z.string().trim().min(2).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
 side:z.enum(["up","down","yes","no"])
}).strict();

export const eventTradeInput=z.object({
 order_type:z.enum(["buy","sell"]),
 trade_size:z.number().int().positive().max(1000000),
 event_id:z.string().trim().min(1).max(180).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
 side:z.enum(["up","down","yes","no"])
}).strict();

export function canRecordBotTrade(status:string,marketType:string,venue:string|null,eventTag:string|null){
 return (status==="MONITORING"||status==="TRADING")&&marketType==="PREDICTION"&&venue==="kalshi"&&Boolean(eventTag);
}
