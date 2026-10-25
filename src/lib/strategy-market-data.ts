import {prisma} from "./db";

export function usdc(micros:bigint){return (Number(micros)/1e6).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});}
export function pct(amount:bigint,base:bigint){return base>0n?Number(amount*10000n/base)/100:null;}
export async function strategyMarketRows(){
 const strategies=await prisma.strategy.findMany({where:{isPublic:true},orderBy:{name:"asc"}});
 const positions=await prisma.investorPosition.groupBy({by:["strategyId"],where:{strategyId:{in:strategies.map(s=>s.id)},status:{in:["OPEN","CLOSING"]}},_sum:{allocatedUsdcMicros:true}});
 const positionMap=new Map(positions.map(p=>[p.strategyId,p._sum.allocatedUsdcMicros??0n]));
 const pnl=await prisma.positionTradePnl.findMany({where:{strategyTrade:{strategyId:{in:strategies.map(s=>s.id)}},status:"SETTLED"},select:{strategyTrade:{select:{strategyId:true}},netPnlUsdcMicros:true,eligibleCapitalUsdcMicros:true,settledAt:true}});
 const display=await prisma.strategyDisplayTrade.findMany({where:{strategyId:{in:strategies.filter(s=>s.isShowcase).map(s=>s.id)}}});
 const now=Date.now();
 return strategies.map(s=>{
  const rows=s.isShowcase?display.filter(p=>p.strategyId===s.id).map(p=>({netPnlUsdcMicros:p.netPnlUsdcMicros,eligibleCapitalUsdcMicros:p.eligibleCapitalUsdcMicros,settledAt:p.occurredAt})):pnl.filter(p=>p.strategyTrade.strategyId===s.id);
  const lifetime=rows.reduce((n,p)=>n+(p.netPnlUsdcMicros??0n),0n);
  const latest=rows.filter(p=>p.settledAt&&p.settledAt.getTime()>=now-86400000);
  const dayPnl=latest.reduce((n,p)=>n+(p.netPnlUsdcMicros??0n),0n);
  const dayBasis=latest.reduce((n,p)=>n+p.eligibleCapitalUsdcMicros,0n);
  return {id:s.id,name:s.name,symbol:s.symbol,logo:s.logo,description:s.description,isShowcase:s.isShowcase,
   allocation:s.isShowcase?s.displayAllocationUsdcMicros:(positionMap.get(s.id)??0n),lifetime,dayPnl,dayPct:pct(dayPnl,dayBasis),settledCount:rows.length};
 });
}
