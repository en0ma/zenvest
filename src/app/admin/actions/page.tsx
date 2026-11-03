import Link from "next/link";
import {prisma} from "@/lib/db";
import {requireStaffPermission} from "@/lib/staff-access";
import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth";
import ReviewControls from "./review-controls";
import WithdrawalDispatch from "./withdrawal-dispatch";
import DepositReplay from "./deposit-replay";
import PlatformWithdrawalControls from "./platform-withdrawal-controls";
import KalshiReturnSimulation from "./kalshi-return-simulation";
import ActionProposalForm from "./proposal-form";
import {isWithinReviewWindow} from "@/lib/staff-review-policy";
import type {StaffPermissionKey} from "@/lib/staff-permissions";
export const dynamic="force-dynamic";
const reviewPermissions:Record<string,StaffPermissionKey>={"users:write":"users:write","deposits:reconcile":"deposits:reconcile","withdrawals:approve":"withdrawals:approve","balances:adjust":"balances:adjust","wallets:operate":"wallets:operate"};
export default async function ActionQueue(){
 try{await requireStaffPermission("audit:read")}catch{return <main className="p-10">Access denied</main>}
 const session=await getServerSession(authOptions),actor=session?.user?.id;
 const memberships=actor?await prisma.staffRoleMembership.findMany({where:{userId:actor},include:{role:{include:{grants:{include:{permission:true}}}}}}):[];
 const grants=new Set(memberships.flatMap(m=>m.role.grants.map(g=>g.permission.key)));
 const items=await prisma.staffAction.findMany({take:50,orderBy:{createdAt:"desc"},select:{id:true,resource:true,operation:true,targetId:true,reason:true,payload:true,status:true,createdAt:true,requestedBy:true,decidedBy:true}});
 const existingPayouts=await prisma.platformWithdrawal.findMany({where:{staffActionId:{in:items.map(item=>item.id)}},select:{id:true,staffActionId:true,status:true}});
 const payoutByAction=new Map(existingPayouts.map(item=>[item.staffActionId,item]));
 return <main className="min-h-screen bg-slate-50 p-8 text-[#14253D]"><div className="mx-auto max-w-6xl">
  <Link href="/admin" className="text-violet-700">← Operations</Link>
  <h1 className="mt-6 text-3xl font-bold">Financial action review queue</h1>
  <p className="mt-3 text-slate-600">Two-person approval. Transfers require explicit execution. Kalshi return actions are simulation-only and never move funds.</p>
  <ActionProposalForm allowed={Object.values(reviewPermissions).filter(key=>grants.has(key))}/>
  <div className="mt-8 overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm">
  <thead className="bg-slate-100"><tr>{["Operation","Target","Parameters","Reason","Status","Review"].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead>
  <tbody>{items.map(item=>{
   const permission=reviewPermissions[item.resource+":"+item.operation];
   const canDecide=Boolean(permission&&grants.has(permission)&&actor&&actor!==item.requestedBy&&item.status==="PENDING"&&isWithinReviewWindow(item.createdAt));
   return <tr key={item.id} className="border-t align-top"><td className="p-3">{item.resource} / {item.operation}</td><td className="p-3">{item.targetId}</td><td className="max-w-xs p-3"><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(item.payload)}</pre></td><td className="max-w-xs p-3">{item.reason}</td><td className="p-3">{item.status}</td><td className="p-3">{item.status==="PENDING"?<ReviewControls id={item.id} canDecide={canDecide}/>:item.status==="APPROVED"&&item.resource==="withdrawals"&&item.operation==="approve"&&grants.has("withdrawals:approve")?<WithdrawalDispatch id={item.id}/> :item.status==="APPROVED"&&item.resource==="deposits"&&item.operation==="reconcile"&&grants.has("deposits:reconcile")?<DepositReplay id={item.id}/>:item.resource==="wallets"&&item.operation==="operate"&&grants.has("wallets:operate")&&typeof item.payload==="object"&&item.payload!==null&&!Array.isArray(item.payload)&&"kind" in item.payload&&item.payload.kind==="MASTER_TO_WALLET"&&(item.status==="APPROVED"||item.status==="EXECUTED"&&payoutByAction.has(item.id))?<PlatformWithdrawalControls actionId={item.id} withdrawalId={payoutByAction.get(item.id)?.id} status={payoutByAction.get(item.id)?.status}/>:item.resource==="wallets"&&item.operation==="operate"&&item.status==="APPROVED"&&grants.has("wallets:operate")&&typeof item.payload==="object"&&item.payload!==null&&!Array.isArray(item.payload)&&"kind" in item.payload&&item.payload.kind==="KALSHI_TO_MASTER"?<KalshiReturnSimulation id={item.id}/>:<span>Reviewed</span>}</td></tr>
  })}</tbody></table>
  {items.length===0&&<p className="p-6 text-slate-500">No review requests.</p>}
  </div></div></main>;
}
