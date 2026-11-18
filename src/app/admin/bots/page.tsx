import {redirect} from "next/navigation";
import {requireStaffPermission} from "@/lib/staff-access";
import {prisma} from "@/lib/db";
import {BotStrategyAdminControls} from "@/components/bot-strategy-admin-controls";
import {BotStrategySettings} from "@/components/bot-strategy-settings";
export const dynamic="force-dynamic";
export default async function AdminBots(){
 let actor:string;
 try{actor=await requireStaffPermission("roles:manage")}catch{redirect("/dashboard")}
 const superAdmin=await prisma.userRole.findFirst({where:{userId:actor,role:{key:"super-admin"}},select:{userId:true}});
 if(!superAdmin)redirect("/admin");
 const bots=await prisma.bot.findMany({include:{owner:{select:{email:true,handle:true}},
  strategy:{select:{id:true,name:true,status:true,publicKey:true,kalshiWalletAddress:true,blockRadarAddress:true,
   managerProfitPercentage:true,platformStrategyPercentage:true,sandboxFeeBps:true,admissionMinDays:true,admissionMinFills:true,admissionMaxDrawdownPct:true,maxCapacityUsdcMicros:true,
   _count:{select:{positions:true,trades:true}}}}},orderBy:{createdAt:"desc"},take:200});
 return <main className="min-h-screen bg-slate-50 p-6 text-[#14253D]">
  <div className="mx-auto max-w-5xl space-y-5"><h1 className="text-3xl font-bold">Bot strategy approvals</h1>
   <p className="text-sm text-slate-600">Only Super Admin can promote strategies or begin shutdown. Shutdown never credits unverified funds.</p>
   {bots.map(b=><section key={b.id} className="space-y-2 rounded-xl border bg-white p-5">
    <h2 className="font-semibold">{b.name} — {b.strategy.status}</h2>
    <p className="text-xs text-slate-600">Owner: @{b.owner.handle} · Strategy: {b.strategy.id} · Positions: {b.strategy._count.positions} · Trade events: {b.strategy._count.trades}</p>
    <p className="text-xs text-slate-500">Kalshi wallet: {b.strategy.kalshiWalletAddress?"Configured":"Missing"} · Blockradar wallet: {b.strategy.blockRadarAddress?"Configured":"Missing"}</p>
    <BotStrategySettings strategyId={b.strategy.id} initial={{
     manager_percentage:b.strategy.managerProfitPercentage.toFixed(4),platform_percentage:b.strategy.platformStrategyPercentage.toFixed(4),
     sandbox_fee_bps:b.strategy.sandboxFeeBps,admission_min_days:b.strategy.admissionMinDays,
     admission_min_fills:b.strategy.admissionMinFills,admission_max_drawdown_pct:b.strategy.admissionMaxDrawdownPct?.toFixed(4)??"",
     total_capacity_usdc:(b.strategy.maxCapacityUsdcMicros/1000000n).toString()+"."+((b.strategy.maxCapacityUsdcMicros%1000000n).toString().padStart(6,"0"))
    }}/>
    <BotStrategyAdminControls strategyId={b.strategy.id} status={b.strategy.status}/>
   </section>)}
  </div>
 </main>;
}
