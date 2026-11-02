export type ReviewState = "PENDING"|"APPROVED"|"REJECTED"|"EXECUTED";
export type ReviewInput = {status:ReviewState;requestedBy:string;actorId:string;hasPermission:boolean;isTwoFactorVerified:boolean};
export function canReviewAction(input:ReviewInput):boolean {
 return input.status==="PENDING"&&input.requestedBy!==input.actorId&&input.hasPermission&&input.isTwoFactorVerified;
}
export function validateActionTarget(resource:string,operation:string):boolean {
 const supported:Record<string,readonly string[]> = {
  users:["write"],deposits:["reconcile"],withdrawals:["approve"],balances:["adjust"],wallets:["operate"]
 };
 return supported[resource]?.includes(operation)??false;
}
