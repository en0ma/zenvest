import {prisma} from "./db";

export function usdc(micros:bigint){return (Number(micros)/1e6).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});}
export function pct(amount:bigint,base:bigint){return base>0n?Number(amount*10000n/base)/100:null;}
export async function strategyMarketRows(){
 const strategies=await prisma.strategy.findMany({where:{isActive:true,isPublic:true},orderBy:{name:"asc"}});
 const positions=await prisma.investorPosition.groupBy({by:["strategyId"],where:{strategyId:{in:strategies.map(s=>s.id)},status:{in:["OPEN","CLOSING"]}},_sum:{allocatedUsdcMicros:true}});
 const positionMap=new Map(positions.map(p=>[p.strategyId,p._sum.allocatedUsdcMicros??0n]));
 const pnl=await prisma.positionTradePnl.findMany({where:{strategyTrade:{strategyId:{in:strategies.map(s=>s.id)}},status:"SETTLED"},select:{strategyTrade:{select:{strategyId:true}},netPnlUsdcMicros:true,eligibleCapitalUsdcMicros:true,settledAt:true}});
 const now=Date.now();
 return strategies.map(s=>{
  const rows=pnl.filter(p=>p.strategyTrade.strategyId===s.id);
  const lifetime=rows.reduce((n,p)=>n+(p.netPnlUsdcMicros??0n),0n);
  const latest=rows.filter(p=>p.settledAt&&p.settledAt.getTime()>=now-86400000);
  const windowPct=(duration:number)=>{const period=rows.filter(p=>p.settledAt&&p.settledAt.getTime()>=now-duration&&p.settledAt.getTime()<=now);const gain=period.reduce((n,p)=>n+(p.netPnlUsdcMicros??0n),0n);const basis=period.reduce((n,p)=>n+p.eligibleCapitalUsdcMicros,0n);return pct(gain,basis);};
  const dayPnl=latest.reduce((n,p)=>n+(p.netPnlUsdcMicros??0n),0n);
  const hourPct=windowPct(3600000);
  const dayPct=windowPct(86400000);
  const monthPct=windowPct(30*86400000);
  return {id:s.id,name:s.name,symbol:s.symbol,logo:s.logo,description:s.description,
   allocation:positionMap.get(s.id)??0n,lifetime,dayPnl,dayPct,hourPct,monthPct,settledCount:rows.length};
 });
}
