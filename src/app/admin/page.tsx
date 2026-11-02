import Link from "next/link";
import {prisma} from "@/lib/db";
import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth";
import {redirect} from "next/navigation";
import type {StaffPermissionKey} from "@/lib/staff-permissions";
export const dynamic="force-dynamic";
const areas:{name:string;key:StaffPermissionKey}[]=[{name:"users",key:"users:read"},{name:"deposits",key:"deposits:read"},{name:"withdrawals",key:"withdrawals:read"},{name:"balances",key:"balances:read"},{name:"wallets",key:"wallets:read"},{name:"roles",key:"roles:read"},{name:"audit",key:"audit:read"}];
export default async function Admin(){
 const session=await getServerSession(authOptions);if(!session?.user?.id)redirect("/login");
 const id=session.user.id;
 const [user,twoFactor,memberships]=await Promise.all([prisma.user.findUnique({where:{id},select:{isActive:true,emailVerifiedAt:true}}),prisma.twoFactor.findUnique({where:{userId:id},select:{verifiedAt:true}}),prisma.staffRoleMembership.findMany({where:{userId:id},select:{role:{select:{grants:{select:{permission:{select:{key:true}}}}}}}}})]);
 if(!user?.isActive||!user.emailVerifiedAt||!twoFactor?.verifiedAt)return <main className="p-10">Admin access denied. Verified account and two-factor authentication required.</main>;
 const permissions=new Set(memberships.flatMap(m=>m.role.grants.map(g=>g.permission.key)));
 if(!permissions.size)return <main className="p-10">Admin access denied. No staff permissions assigned.</main>;
 return <main className="min-h-screen bg-slate-50 p-8 text-[#14253D]"><div className="mx-auto max-w-5xl"><h1 className="text-3xl font-bold">Zenvest operations</h1><p className="mt-3 text-slate-600">Resource-specific access · independent approval required for sensitive actions · approval never executes money movement.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{areas.filter(a=>permissions.has(a.key)).map(a=><Link key={a.name} href={"/admin/"+a.name} className="rounded-xl border bg-white p-6 text-lg font-semibold capitalize shadow-sm hover:border-violet-500">{a.name}</Link>)}</div></div></main>;
}
