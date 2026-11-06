export type ReviewState = "PENDING"|"APPROVED"|"REJECTED"|"EXECUTED";
export type ReviewInput = {status:ReviewState;requestedBy:string;actorId:string;hasPermission:boolean;isTwoFactorVerified:boolean};
export const REVIEW_WINDOW_MS=24*60*60*1000;
export function isWithinReviewWindow(createdAt:Date,now:Date=new Date()):boolean {
 const age=now.getTime()-createdAt.getTime();
 return Number.isFinite(age)&&age>=0&&age<=REVIEW_WINDOW_MS;
}
export function canReviewAction(input:ReviewInput & {createdAt:Date;now?:Date}):boolean {
 return input.status==="PENDING"&&input.requestedBy!==input.actorId&&input.hasPermission&&input.isTwoFactorVerified&&isWithinReviewWindow(input.createdAt,input.now);
}
export function validateActionTarget(resource:string,operation:string):boolean {
 const supported:Record<string,readonly string[]> = {
  users:["write"],wallets:["operate"]
 };
 return supported[resource]?.includes(operation)??false;
}
