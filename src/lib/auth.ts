import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {verifyChallenge,consumeRecoveryCode,IDLE_MS} from "@/lib/two-factor";
import {randomUUID} from "node:crypto";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        challengeId: { label: "Verification request", type: "text" },
        code: { label: "Verification code", type: "text" },
        recoveryCode: { label: "Recovery code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.trim().toLowerCase();
        if (email.length > 254 || credentials.password.length > 72) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.isActive || !user.emailVerifiedAt) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        const twoFactor=await prisma.twoFactor.findUnique({where:{userId:user.id}});
        if(twoFactor){
          const verified=credentials.recoveryCode?await consumeRecoveryCode(user.id,credentials.recoveryCode):Boolean(credentials.challengeId&&credentials.code&&await verifyChallenge(credentials.challengeId,user.id,"LOGIN",credentials.code));
          if(!verified)return null;
        }
        const sid=randomUUID();
        await prisma.securitySession.create({data:{id:sid,userId:user.id}});
        return { id: user.id, email: user.email, name: user.name, image:sid };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.sub = user.id; token.sessionVersion = undefined; token.sid=user.image; }
      // Check permissions against the database on every session request.
      // Never trust a role supplied by the browser or an old JWT claim.
      if (!token.sub) return token;
      const [record, device] = await Promise.all([
        prisma.user.findUnique({ where: { id: token.sub }, select: { isActive: true, role: true, emailVerifiedAt: true, sessionVersion: true } }),
        typeof token.sid==="string"?prisma.securitySession.findUnique({where:{id:token.sid}}):Promise.resolve(null)
      ]);
      if (token.sessionVersion === undefined && user && record) token.sessionVersion = record.sessionVersion;
      token.active = Boolean(record?.isActive && record.emailVerifiedAt && token.sessionVersion === record.sessionVersion && device?.userId===token.sub && Date.now()-device.lastActivityAt.getTime()<IDLE_MS && Date.now()-device.createdAt.getTime()<12*60*60*1000);
      token.role = record?.role ?? "USER";
      return token;
    },
    async session({ session, token }) {
      if (!token.active || !token.sub) return { ...session, user: undefined };
      return { ...session, user: { id: token.sub, role: token.role, name: session.user?.name, email: session.user?.email } };
    },
  },
};
