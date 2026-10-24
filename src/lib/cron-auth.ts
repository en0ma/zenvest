import {timingSafeEqual} from "node:crypto";
export function authorizedCron(request:Request):boolean{
 const secret=process.env.CRON_SECRET;
 const authorization=request.headers.get("authorization")??"";
 if(!authorization.startsWith("Bearer "))return false;
 const supplied=authorization.slice("Bearer ".length);
 return !!secret&&!!supplied&&Buffer.byteLength(secret)===Buffer.byteLength(supplied)&&timingSafeEqual(Buffer.from(secret),Buffer.from(supplied));
}
