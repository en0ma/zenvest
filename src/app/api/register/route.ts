import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validation";
import { issueToken, tokenLink } from "@/lib/account-tokens";
import { sendAccountEmail } from "@/lib/email";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check your display name, email and password requirements." }, { status: 400 });
  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({where:{email}});
  if (existing?.isActive && !existing.emailVerifiedAt) {
    try {
      const recent=await prisma.actionToken.findFirst({where:{userId:existing.id,purpose:"VERIFY_EMAIL",createdAt:{gt:new Date(Date.now()-60_000)}}});
      if (!recent) {
        const token=await issueToken(existing.id,"VERIFY_EMAIL");
        await sendAccountEmail(email,"Activate your Zenvest account","Activate your account using this link:",tokenLink("/verify-email",token),existing.name);
      }
    } catch {console.error("Activation reissue failed")}
    return NextResponse.json({ok:true,code:"CHECK_EMAIL",message:"If this address is awaiting activation, check your inbox or request another activation link."},{status:202});
  }
  if (existing) return NextResponse.json({code:"ACCOUNT_EXISTS",error:"An account is associated with this email. Log in, reset your password, or resend activation."},{status:409});
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await prisma.user.create({ data: { name, email, passwordHash, role: "INVESTOR", portfolio: { create: { mode: "SANDBOX" } } } });
    try { const token = await issueToken(user.id,"VERIFY_EMAIL"); await sendAccountEmail(email,"Activate your Zenvest account","Activate your account using this link:",tokenLink("/verify-email",token)); } catch { console.error("Activation delivery failed; user can request another link"); }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ code:"ACCOUNT_EXISTS", error: "An account is associated with this email. Log in, reset your password, or resend activation." }, { status: 409 });
    }
    console.error("Registration storage error");
    return NextResponse.json({ error: "Registration unavailable" }, { status: 503 });
  }
}
