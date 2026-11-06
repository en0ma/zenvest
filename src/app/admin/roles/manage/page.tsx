import Link from "next/link";
import {requireStaffPermission} from "@/lib/staff-access";
import RoleManager from "./role-manager";
import {prisma} from "@/lib/db";
import ReviewerRoleSettings from "./reviewer-role-settings";
import {APPROVAL_POLICY_ID} from "@/lib/staff-approval-policy";
export const dynamic="force-dynamic";
export default async function ManageRoles(){
 let actor:string;
 try{actor=await requireStaffPermission("roles:manage")}catch{return <main className="p-10">Access denied</main>}
 const isSuperAdmin=await prisma.userRole.count({where:{userId:actor,role:{key:"super-admin"}}});
 if(!isSuperAdmin)return <main className="p-10">Access denied</main>;
 const policy=await prisma.staffApprovalPolicy.findUnique({where:{id:APPROVAL_POLICY_ID},select:{additionalRoleKeys:true}});
 return <main className="min-h-screen bg-slate-50 p-8 text-[#14253D]"><div className="mx-auto max-w-4xl"><Link href="/admin" className="text-violet-700">← Operations</Link><h1 className="mt-6 text-3xl font-bold">Staff role management</h1><RoleManager/><ReviewerRoleSettings initialRoles={policy?.additionalRoleKeys??[]}/></div></main>;
}
