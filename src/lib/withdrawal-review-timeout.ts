// Operational alert age, never an authorization to release investor funds.
export const REVIEW_ALERT_AFTER_MS=2*60*60*1000;
export function reviewAlertCutoff(now:Date):Date{
 if(Number.isNaN(now.getTime()))throw new Error("Invalid current time");
 return new Date(now.getTime()-REVIEW_ALERT_AFTER_MS);
}
