import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireStaffPermission } from "@/lib/staff-access";

export type InvestorPermission="account:access"|"portfolio:read:own"|"wallet:read:own"|"deposits:create:own"|"withdrawals:create:own"|"allocations:create:own";
export async function requireUser(permission:InvestorPermission="account:access") {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const memberships=await prisma.userRole.findMany({where:{userId:session.user.id},
    select:{role:{select:{key:true,grants:{select:{permission:{select:{key:true}}}}}}}});
  if(!memberships.some(m=>m.role.key==="user")||
     !memberships.some(m=>m.role.grants.some(g=>g.permission.key===permission)))redirect("/login");
  return session.user;
}

export async function requireInvestorPermission(userId:string,permission:InvestorPermission){
 const grant=await prisma.userRole.findFirst({where:{userId,role:{grants:{some:{permission:{key:permission}}}}},select:{userId:true}});
 if(!grant)redirect("/login");
}

export async function requireAdmin() {
  try { await requireStaffPermission("roles:manage"); }
  catch { redirect("/dashboard"); }
  return requireUser();
}
