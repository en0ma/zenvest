export const REVIEW_TIMEOUT_MS=2*60*60*1000;
export function reviewExpiryCutoff(now:Date):Date{
 if(Number.isNaN(now.getTime()))throw new Error("Invalid current time");
 return new Date(now.getTime()-REVIEW_TIMEOUT_MS);
}
