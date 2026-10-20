import {timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
import {prisma} from "@/lib/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function authorized(request:Request){
 const secret=process.env.CRON_SECRET;
 const value=request.headers.get("authorization")?.replace(/^Bearer /,"")??"";
 return Boolean(secret&&value&&Buffer.byteLength(secret)===Buffer.byteLength(value)&&timingSafeEqual(Buffer.from(secret!),Buffer.from(value)));
}
// Deliberately monitor-only until the exact Kalshi funding rail, return rail and
// both sides' authenticated settlement events are implemented and reviewed.
// Never mark an operation in-flight without initiating a verified transfer.
export async function GET(request:Request){
 if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 const pending=await prisma.positionDeallocation.aggregate({where:{status:"PENDING"},_count:{_all:true},_sum:{amountUsdcMicros:true}});
 return NextResponse.json({status:"awaiting_verified_transfer_integration",direction:"kalshi_to_master",requests:pending._count._all,amountUsdcMicros:(pending._sum.amountUsdcMicros??0n).toString()});
}
