import {createHash,randomBytes} from "node:crypto";
export const BOT_MANAGER_ROLE="bot";
export const STRATEGY_LIFECYCLE=["ONBOARDING","MONITORING","TRADING","SHUTTING_DOWN","SHUTDOWN"] as const;
export function canPromoteStrategy(from:string,to:string){
 return from==="ONBOARDING"&&to==="MONITORING"||from==="MONITORING"&&to==="TRADING";
}
export function canRevokeBotRole(statuses:readonly string[]){return statuses.every(status=>status==="SHUTDOWN")}
export function canAcceptNewTrade(status:string){return status==="MONITORING"||status==="TRADING"}
export function hashBotKey(raw:string){return createHash("sha256").update(raw).digest("hex")}
export function generateBotKey(){
 const raw="zvb_"+randomBytes(32).toString("base64url");
 return {raw,hash:hashBotKey(raw),prefix:raw.slice(0,12)};
}
