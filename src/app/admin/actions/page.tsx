import Link from "next/link";
import {prisma} from "@/lib/db";
import {requireStaffPermission} from "@/lib/staff-access";
export const dynamic="force-dynamic";
export default async function ActionQueue(){
 try{await requireStaffPermission("audit:read")}catch{return <main className="p-10">Access denied</main>}
 const items=await prisma.staffAction.findMany({take:50,orderBy:{createdAt:"desc"},select:{id:true,resource:true,operation:true,targetId:true,status:true,requestedBy:true,decidedBy:true,createdAt:true}});
 return <main className="min-h-screen bg-slate-50 p-8 text-[#14253D]">
  <div className="mx-auto max-w-6xl"><Link href="/admin" className="text-violet-700">← Operations</Link>
   <h1 className="mt-6 text-3xl font-bold">Financial action review queue</h1>
   <p className="mt-3 text-slate-600">Requests require separate authorized review. Approved actions are not executed automatically.</p>
   <div className="mt-8 overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm">
    <thead className="bg-slate-100"><tr>{["Operation","Resource","Target","Status","Requested by","Decided by"].map(c=><th className="p-3" key={c}>{c}</th>)}</tr></thead>
    <tbody>{items.map(item=><tr key={item.id} className="border-t">
     <td className="p-3">{item.operation}</td><td className="p-3">{item.resource}</td><td className="p-3">{item.targetId}</td><td className="p-3">{item.status}</td><td className="p-3">{item.requestedBy}</td><td className="p-3">{item.decidedBy??"—"}</td>
    </tr>)}</tbody>
   </table>{items.length===0&&<p className="p-6 text-slate-500">No action requests yet.</p>}</div>
  </div>
 </main>;
}
