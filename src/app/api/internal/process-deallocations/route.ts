import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";

// Monitor pending Kalshi liquidity requests. No Kalshi API credentials or
// fund movements are implemented yet: requests remain PENDING until a
// future audited integration verifies transfers back to master custody.
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  const bearer=request.headers.get("authorization")?.replace(/^Bearer /,"")??"";
  if(!secret||Buffer.byteLength(secret)!==Buffer.byteLength(bearer)||
     !timingSafeEqual(Buffer.from(secret),Buffer.from(bearer)))
    return NextResponse.json({error:"Unauthorized"},{status:401});
  const rows=await prisma.withdrawalDeallocation.aggregate({
    where:{status:"PENDING"},_sum:{amountUsdcMicros:true},_count:{_all:true},
  });
  const total=rows._sum.amountUsdcMicros??0n;
  console.info(JSON.stringify({component:"kalshi-deallocation-cron",outcome:"awaiting_integration",
    requestCount:rows._count._all,amountUsdcMicros:total.toString()}));
  return NextResponse.json({status:"awaiting_kalshi_integration",
    requests:rows._count._all,amountUsdcMicros:total.toString()});
}
