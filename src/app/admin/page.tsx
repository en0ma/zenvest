import Link from "next/link";
import {redirect} from "next/navigation";
import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth";
import {prisma} from "@/lib/db";
import type {StaffPermissionKey} from "@/lib/staff-permissions";

export const dynamic = "force-dynamic";
const sections: Array<{ name: string; permission: StaffPermissionKey }> = [
 {name:"users",permission:"users:read"},
 {name:"deposits",permission:"deposits:read"},
 {name:"withdrawals",permission:"withdrawals:read"},
 {name:"balances",permission:"balances:read"},
 {name:"wallets",permission:"wallets:read"},
 {name:"roles",permission:"roles:read"},
 {name:"audit",permission:"audit:read"},
 {name:"actions",permission:"audit:read"},
 {name:"roles/manage",permission:"roles:manage"},
];
export default async function AdminPage(){
 const session=await getServerSession(authOptions);
 if(!session?.user?.id) redirect("/login");
 const userId=session.user.id;
 const account=await prisma.user.findUnique({where:{id:userId},select:{isActive:true,emailVerifiedAt:true}});
 const factor=await prisma.twoFactor.findUnique({where:{userId},select:{verifiedAt:true}});
 if(!account?.isActive||!account.emailVerifiedAt||!factor?.verifiedAt){
  return <main className="p-10">Staff access requires an active verified account and two-factor authentication.</main>;
 }
 const memberships=await prisma.userRole.findMany({
  where:{userId},
  include:{role:{include:{grants:{include:{permission:true}}}}}
 });
 const grants=new Set(memberships.flatMap(m=>m.role.grants.map(g=>g.permission.key)));
 if(grants.size===0)return <main className="p-10">No staff permissions assigned.</main>;
 return <main className="min-h-screen bg-slate-50 p-8 text-[#14253D]">
  <div className="mx-auto max-w-5xl">
   <h1 className="text-3xl font-bold">Zenvest operations</h1>
   <p className="mt-3 text-slate-600">Sensitive actions require independent approval and do not move funds automatically.</p>
   <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {sections.filter(s=>grants.has(s.permission)).map(s=><Link key={s.name} href={"/admin/"+s.name} className="rounded-xl border bg-white p-6 text-lg font-semibold capitalize shadow-sm hover:border-violet-500">{s.name==="roles/manage"?"Manage roles":s.name}</Link>)}
   </div>
  </div>
 </main>;
}
