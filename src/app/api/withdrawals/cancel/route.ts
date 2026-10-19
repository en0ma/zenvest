import { NextResponse } from "next/server";

// Withdrawal cancellation is intentionally unsupported. Accepted requests
// remain reserved until a verified payout outcome or authorized reconciliation.
export async function POST() {
  return NextResponse.json({error:"Withdrawal requests cannot be cancelled"},{status:410});
}
