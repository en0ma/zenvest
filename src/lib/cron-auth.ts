import {timingSafeEqual} from "node:crypto";
export function authorizedCron(request:Request):boolean{
 const secret=process.env.CRON_SECRET;
 const supplied=request.headers.get("authorization")?.replace(/^Bearer /,"")??"";
 return !!secret&&!!supplied&&Buffer.byteLength(secret)===Buffer.byteLength(supplied)&&timingSafeEqual(Buffer.from(secret),Buffer.from(supplied));
}
