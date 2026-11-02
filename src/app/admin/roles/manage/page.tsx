import Link from "next/link";
import {requireStaffPermission} from "@/lib/staff-access";
import RoleManager from "./role-manager";
export const dynamic="force-dynamic";
export default async function ManageRoles(){
 try{await requireStaffPermission("roles:manage")}catch{return <main className="p-10">Access denied</main>}
 return <main className="min-h-screen bg-slate-50 p-8 text-[#14253D]"><div className="mx-auto max-w-4xl"><Link href="/admin" className="text-violet-700">← Operations</Link><h1 className="mt-6 text-3xl font-bold">Staff role management</h1><RoleManager/></div></main>;
}
