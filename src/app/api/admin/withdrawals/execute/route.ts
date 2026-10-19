import { NextResponse } from "next/server";
// Manual execution is deliberately disabled. Cron is the sole payout broadcaster.
export async function POST(){return NextResponse.json({error:"Manual payout execution disabled"},{status:410});}
