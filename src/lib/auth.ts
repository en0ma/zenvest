import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.trim().toLowerCase();
        if (email.length > 254 || credentials.password.length > 72) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.isActive) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        return valid ? { id: user.id, email: user.email, name: user.name } : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      // Check permissions against the database on every session request.
      // Never trust a role supplied by the browser or an old JWT claim.
      if (!token.sub) return token;
      const record = await prisma.user.findUnique({ where: { id: token.sub }, select: { isActive: true, role: true } });
      token.active = Boolean(record?.isActive);
      token.role = record?.role ?? "INVESTOR";
      return token;
    },
    async session({ session, token }) {
      if (!token.active || !token.sub) return { ...session, user: undefined };
      return { ...session, user: { ...session.user, id: token.sub, role: token.role } };
    },
  },
};
