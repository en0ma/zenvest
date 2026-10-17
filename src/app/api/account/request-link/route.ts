import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { issueToken, tokenLink } from "@/lib/account-tokens";
import { sendAccountEmail } from "@/lib/email";
export const runtime = "nodejs";
const schema=z.object({email:z.string().trim().toLowerCase().email().max(254),purpose:z.enum(["VERIFY_EMAIL","RESET_PASSWORD"])}).strict();
export async function POST(request:Request){
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Invalid request"},{status:400});
 const {email,purpose}=parsed.data;
 const generic={message:"If your account is eligible, an email will be sent."};
 try{
  const user=await prisma.user.findUnique({where:{email}});
  if(user?.isActive && (purpose==="RESET_PASSWORD" || !user.emailVerifiedAt)){
   const recent=await prisma.actionToken.findFirst({where:{userId:user.id,purpose,createdAt:{gt:new Date(Date.now()-60_000)}}});
   if(recent) return NextResponse.json(generic);
   const token=await issueToken(user.id,purpose);
   const path=purpose==="VERIFY_EMAIL"?"/verify-email":"/reset-password";
   await sendAccountEmail(user.email,purpose==="VERIFY_EMAIL"?"Verify your Zenvest email":"Reset your Zenvest password",purpose==="VERIFY_EMAIL"?"Activate your account using this link:":"Reset your password using this link:",tokenLink(path,token));
  }
 }catch{console.error("Account email request failed")}
 return NextResponse.json(generic);
}
