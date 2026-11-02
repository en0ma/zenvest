import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth";
import {prisma} from "@/lib/db";
import type {StaffPermissionKey} from "@/lib/staff-permissions";
import {isFreshStaffLogin} from "@/lib/staff-login-freshness";

export async function requireStaffPermission(key:StaffPermissionKey,options?:{requireFreshLogin?:boolean}):Promise<string>{
 const session=await getServerSession(authOptions);
 const userId=session?.user?.id;
 if(!userId)throw new Error("UNAUTHENTICATED");
 if(options?.requireFreshLogin){
  const issued=(session as typeof session & {staffLoginAt?:number}).staffLoginAt;
  if(!isFreshStaffLogin(issued))throw new Error("STAFF_FRESH_LOGIN_REQUIRED");
 }
 const [account,memberships,factor]=await Promise.all([
  prisma.user.findUnique({where:{id:userId},select:{isActive:true,emailVerifiedAt:true}}),
  prisma.staffRoleMembership.findMany({where:{userId},select:{role:{select:{grants:{select:{permission:{select:{key:true}}}}}}}}),
  prisma.twoFactor.findUnique({where:{userId},select:{verifiedAt:true}})
 ]);
 if(!account?.isActive||!account.emailVerifiedAt||!factor?.verifiedAt)throw new Error("FORBIDDEN");
 if(!memberships.some(m=>m.role.grants.some(g=>g.permission.key===key)))throw new Error("FORBIDDEN");
 return userId;
}
