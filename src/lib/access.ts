import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireStaffPermission } from "@/lib/staff-access";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const baseline=await prisma.userRole.findFirst({where:{userId:session.user.id,role:{key:"user"}},select:{userId:true}});
  if(!baseline)redirect("/login");
  return session.user;
}

export async function requireAdmin() {
  try { await requireStaffPermission("roles:manage"); }
  catch { redirect("/dashboard"); }
  return requireUser();
}
