import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { TokenPurpose } from "@prisma/client";
export const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export function makeToken() { return randomBytes(32).toString("hex"); }
export function tokenLink(path: string, token: string) {
 const origin = process.env.NODE_ENV === "production" ? "https://www.zenvest.market" : process.env.NEXTAUTH_URL;
 if (!origin) throw new Error("NEXTAUTH_URL missing");
 const base = new URL(origin);
 if (process.env.NODE_ENV === "production" && base.protocol !== "https:") throw new Error("HTTPS required");
 const url = new URL(path, base);
 url.searchParams.set("token", token);
 return url.toString();
}
export async function issueToken(userId: string, purpose: TokenPurpose) {
 const token = makeToken();
 await prisma.$transaction(async tx => {
  await tx.actionToken.deleteMany({where:{userId,purpose}});
  await tx.actionToken.create({data:{userId,purpose,hash:digest(token),expiresAt:new Date(Date.now()+(purpose==="VERIFY_EMAIL"?24*60:30)*60*1000)}});
 });
 return token;
}
export async function consumeToken(token: string, purpose: TokenPurpose, passwordHash?:string) {
 if (!/^[a-f0-9]{64}$/.test(token)) return false;
 return prisma.$transaction(async tx => {
  const record = await tx.actionToken.findUnique({where:{hash:digest(token)},include:{user:true}});
  if (!record || record.purpose!==purpose || record.expiresAt.getTime() <= Date.now() || !record.user.isActive) return false;
  const deleted = await tx.actionToken.deleteMany({where:{id:record.id,hash:record.hash}});
  if (deleted.count!==1) return false;
  if (purpose==="VERIFY_EMAIL") await tx.user.update({where:{id:record.userId},data:{emailVerifiedAt:new Date()}});
  else {
   if (!passwordHash) throw new Error("Password hash required");
   await tx.user.update({where:{id:record.userId},data:{passwordHash,sessionVersion:{increment:1}}});
   await tx.actionToken.deleteMany({where:{userId:record.userId,purpose:"RESET_PASSWORD"}});
  }
  return true;
 });
}
