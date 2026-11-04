import Link from "next/link";
import {notFound} from "next/navigation";
import {prisma} from "@/lib/db";
import {requireStaffPermission} from "@/lib/staff-access";
import type {StaffPermissionKey} from "@/lib/staff-permissions";
export const dynamic="force-dynamic";
const permissions:Record<string,StaffPermissionKey>={users:"users:read",deposits:"deposits:read",withdrawals:"withdrawals:read",balances:"balances:read",wallets:"wallets:read",audit:"audit:read",roles:"roles:read"};
export default async function ResourcePage({params}:{params:Promise<{resource:string}>}){
 const {resource}=await params,permission=permissions[resource];
 if(!permission)notFound();
 try{await requireStaffPermission(permission)}catch{return <main className="p-10">Access denied</main>}
 let rows:Record<string,unknown>[]=[];
 if(resource==="users")rows=await prisma.user.findMany({take:30,orderBy:{createdAt:"desc"},select:{id:true,handle:true,email:true,isActive:true}}) as unknown as Record<string,unknown>[];
 if(resource==="balances")rows=(await prisma.user.findMany({take:30,select:{id:true,handle:true,unallocated:true}})).map(x=>({id:x.id,handle:x.handle,unallocated:x.unallocated.toString()}));
 if(resource==="deposits")rows=(await prisma.blockchainDeposit.findMany({take:30,orderBy:{createdAt:"desc"},select:{id:true,walletId:true,amountUsdcMicros:true,status:true}})).map(x=>({...x,amountUsdcMicros:x.amountUsdcMicros.toString()}));
 if(resource==="withdrawals")rows=(await prisma.withdrawal.findMany({take:30,orderBy:{createdAt:"desc"},select:{id:true,userId:true,amountUsdcMicros:true,status:true}})).map(x=>({...x,amountUsdcMicros:x.amountUsdcMicros.toString()}));
 if(resource==="wallets")rows=await prisma.investorDepositWallet.findMany({take:30,orderBy:{createdAt:"desc"},select:{id:true,userId:true,address:true,status:true}}) as unknown as Record<string,unknown>[];
 if(resource==="audit")rows=await prisma.staffAudit.findMany({take:30,orderBy:{createdAt:"desc"},select:{id:true,actorId:true,action:true,resource:true,targetId:true}}) as unknown as Record<string,unknown>[];
 if(resource==="roles")rows=await prisma.role.findMany({select:{id:true,key:true}}) as unknown as Record<string,unknown>[];
 const columns=rows.length?Object.keys(rows[0]):[];
 return <main className="min-h-screen bg-slate-50 p-8 text-[#14253D]"><div className="mx-auto max-w-6xl"><Link href="/admin" className="text-violet-700">← Operations</Link><h1 className="mt-5 text-3xl font-bold capitalize">{resource}</h1><p className="mt-2 text-sm text-slate-500">Read-only preview · latest 30 records · actions require separate approval</p><div className="mt-8 overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{columns.map(c=><th key={c} className="p-3">{c}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr className="border-t" key={String(row.id??i)}>{columns.map(c=><td className="max-w-xs truncate p-3" key={c}>{row[c]===null?"—":typeof row[c]==="boolean"?(row[c]?"Yes":"No"):String(row[c]??"")}</td>)}</tr>)}</tbody></table>{!rows.length&&<p className="p-6 text-slate-500">No records found.</p>}</div></div></main>
}
