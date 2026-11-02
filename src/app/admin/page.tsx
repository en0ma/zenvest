import {requireStaffPermission} from "@/lib/staff-access";
import Link from "next/link";
export const dynamic="force-dynamic";
export default async function Admin(){
 try{await requireStaffPermission("users:read")}catch{return <main className="p-10"><h1 className="text-xl font-semibold">Access denied</h1><p>Staff permission and two-factor authentication required.</p></main>}
 return <main className="min-h-screen bg-slate-50 p-8 text-[#14253D]"><h1 className="text-3xl font-bold">Zenvest operations</h1><p className="mt-3">Financial changes require an independent reviewer. Approval never automatically moves funds.</p><div className="mt-8"><Link className="rounded-xl border bg-white p-5" href="/api/admin/users">View users (read permission required)</Link></div></main>
}
