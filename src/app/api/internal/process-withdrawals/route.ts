import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// Payout submissions are disabled until replacement treasury reservation checks exist.
// This prevents unfunded or duplicate transfers while the test schema is being revised.
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 const value=request.headers.get("authorization")?.replace(/^Bearer /,"")??"";
 if(!secret||!value||Buffer.byteLength(secret)!==Buffer.byteLength(value)||
    !timingSafeEqual(Buffer.from(secret),Buffer.from(value)))
  return NextResponse.json({error:"Unauthorized"},{status:401});
 return NextResponse.json({status:"disabled",reason:"Treasury liquidity and reservation reconciliation not implemented"},{status:503});
}
