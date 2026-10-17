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
  if (!parsed.success) return NextResponse.json({ error: "Check your name, email and password (minimum 12 characters)." }, { status: 400 });
  const { name, email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await prisma.user.create({ data: { name, email, passwordHash, role: "INVESTOR" } });
    try { const token = await issueToken(user.id,"VERIFY_EMAIL"); await sendAccountEmail(email,"Activate your Zenvest account","Activate your account using this link:",tokenLink("/verify-email",token)); } catch { console.error("Activation delivery failed; user can request another link"); }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Account already exists" }, { status: 409 });
    }
    console.error("Registration storage error");
    return NextResponse.json({ error: "Registration unavailable" }, { status: 503 });
  }
}
