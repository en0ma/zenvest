import {Shell} from "@/components/shell";
import {StrategyMarketList} from "@/components/strategy-market-list";
import {PositionsTable} from "@/components/positions-table";
import {requireUser} from "@/lib/access";
import {prisma} from "@/lib/db";
import {strategyMarketRows,usdc} from "@/lib/strategy-market-data";
export const dynamic="force-dynamic";
export default async function EarnPage(){
 const user=await requireUser();
 const [market,positions]=await Promise.all([
  strategyMarketRows(),
  prisma.investorPosition.findMany({where:{userId:user.id},include:{strategy:{select:{name:true,symbol:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}]})
 ]);
 return <Shell><div className="mx-auto max-w-6xl space-y-7">
  <header className="px-1"><h1 className="text-2xl font-semibold tracking-tight text-[#14253D]">Explore investment options</h1><p className="mt-1 text-xs text-[#64748B]">Explore the options, see how they’ve performed, and choose whether to invest.</p></header>
  <StrategyMarketList rows={market.map(m=>({...m,allocation:m.allocation.toString(),lifetime:m.lifetime.toString(),dayPnl:m.dayPnl.toString()}))}/>
  <PositionsTable rows={positions.map(p=>({id:p.id,strategy:p.strategy.symbol??p.strategy.name,allocation:usdc(p.allocatedUsdcMicros),status:p.status}))}/>
 </div></Shell>;
}
