export const STAFF_SENSITIVE_SESSION_MAX_AGE_MS=15*60*1000;
export function isFreshStaffLogin(loginAt:unknown,now:number=Date.now()):boolean{
 if(typeof loginAt!=="number"||!Number.isFinite(loginAt)||!Number.isFinite(now))return false;
 const age=now-loginAt;
 return age>=0&&age<=STAFF_SENSITIVE_SESSION_MAX_AGE_MS;
}
