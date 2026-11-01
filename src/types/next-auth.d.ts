import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "ADMIN" | "USER";
    };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN" | "USER";
    active?: boolean;
    sessionVersion?: number;
    sid?: string | null;
  }
}
