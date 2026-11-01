import {PrismaClient} from "@prisma/client";
import {createHash} from "node:crypto";
const prisma=new PrismaClient();
const catalogs=[
 {id:"market_atlas",symbol:"ATLAS",name:"Atlas Directional",logo:"/strategy-logos/atlas.svg",marketType:"PREDICTION",note:"Directional positioning across high-conviction event markets. Risk controls prioritize measured exposure and clear settlement windows.",description:"An active directional strategy focused on event-market price dislocations and disciplined position sizing.",capital:44500000000n,bias:1.05},
 {id:"market_meridian",symbol:"MRDN",name:"Meridian Relative Value",logo:"/strategy-logos/meridian.svg",marketType:"PREDICTION",note:"Cross-market pricing comparisons with selective execution during spread expansions.",description:"Captures differences between related contracts while targeting lower directional exposure.",capital:32800000000n,bias:.85},
 {id:"market_vector",symbol:"VCTR",name:"Vector Momentum",logo:"/strategy-logos/vector.svg",marketType:"PERP",note:"Momentum entry signals, dynamic exits, and volatility-aware risk limits.",description:"Systematic momentum exposure across liquid, actively traded markets.",capital:27100000000n,bias:1.12},
 {id:"market_orbit",symbol:"ORBIT",name:"Orbit Event Rotation",logo:"/strategy-logos/orbit.svg",marketType:"PREDICTION",note:"Short-duration event cycles and active reinvestment of released trading capital.",description:"Rotates capital between short-duration opportunities as event markets reach resolution.",capital:19600000000n,bias:1.1},
 {id:"market_harbor",symbol:"HARBOR",name:"Harbor Market Neutral",logo:"/strategy-logos/harbor.svg",marketType:"SPOT",note:"Defensive execution, smaller exposure bands, and steady capital utilization.",description:"Lower-volatility positioning intended to reduce dependence on broad market direction.",capital:38400000000n,bias:.7},
 {id:"market_summit",symbol:"SUMMIT",name:"Summit Opportunities",logo:"/strategy-logos/summit.svg",marketType:"PREDICTION",note:"Flexible opportunity selection with explicit drawdown guardrails and capped contract risk.",description:"Concentrated opportunities selected for compelling reward-to-risk profiles.",capital:15300000000n,bias:1.18}
];


function random(seed){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
const rand=random(2501025);
const anchor=new Date();anchor.setUTCHours(12,0,0,0);
const investorId="zenvest_market_seed_investor";
const positionIdFor=id=>"c"+createHash("sha256").update("zenvest-market-position:"+id).digest("hex").slice(0,24);
try{
 const results=[];
 await prisma.user.upsert({where:{id:investorId},create:{
  id:investorId,email:"market-history@zenvest.invalid",name:"marketdata",
  handle:"mktdata",passwordHash:"disabled-market-history-account",role:"USER",
  isActive:false,unallocated:0n
 },update:{}});
 for(const config of catalogs){
  const existing=await prisma.strategy.findUnique({where:{id:config.id},select:{id:true,symbol:true}});
  if(existing&&existing.symbol!==config.symbol)throw Error("Strategy identity collision: "+config.id);
  if(!existing)await prisma.strategy.create({data:{
   id:config.id,name:config.name,symbol:config.symbol,logo:config.logo,
   description:config.description,note:config.note,marketType:config.marketType,
   isActive:true,isPublic:true,status:"MONITORING",
   minCapacityUsdcMicros:1000000000n,maxCapacityUsdcMicros:100000000000n,
   availableCapacityUsdcMicros:65000000000n,
   minAllocationUsdcMicros:100000000n,maxAllocationUsdcMicros:50000000000n
  }});
  const positionId=positionIdFor(config.id);
  const trades=[];const positions=[];let netTotal=0n;
  for(let day=59;day>=0;day--)for(let step=0;step<2;step++){
   const stamp=new Date(anchor.getTime()-day*86400000+(step===0?-14400000:10800000));
   const amount=BigInt(Math.round(Number(config.capital)*(.0003+rand()*.0024)*config.bias*(rand()<.76?1:-1)));
   netTotal+=amount;
   const id="market_seed_"+config.symbol+"_"+day+"_"+step;
   const createdAt=new Date(stamp.getTime()-3600000);
   trades.push({id,strategyId:config.id,marketTradeId:id,
    marketTradeName:["Event Spread","Price Rotation","Directional Opportunity","Liquidity Window","Momentum Entry","Event Resolution"][(day+step)%6],
    status:"SETTLED",isPnlCalculated:true,
    eligibleCapitalUsdcMicros:config.capital,realizedPnlUsdcMicros:amount,
    marketStart:createdAt,marketEnd:stamp,createdAt,settledAt:stamp});
   positions.push({strategyTradeId:id,positionId,userId:investorId,
    eligibleCapitalUsdcMicros:config.capital,
    grossPnlUsdcMicros:amount,netPnlUsdcMicros:amount,
    platformFeeUsdcMicros:0n,status:"SETTLED",createdAt,settledAt:stamp});
  }
  const position=await prisma.investorPosition.findUnique({where:{id:positionId}});
  if(position&&(position.userId!==investorId||position.strategyId!==config.id))
   throw Error("Position identity collision: "+positionId);
  if(!position)await prisma.investorPosition.create({data:{id:positionId,
   userId:investorId,strategyId:config.id,status:"OPEN",
   allocatedUsdcMicros:config.capital+netTotal}});
  // Immutable settled records; a rerun never rewrites existing trade outcomes.
  const tradeResult=await prisma.strategyTrade.createMany({data:trades,skipDuplicates:true});
  const pnlResult=await prisma.positionTradePnl.createMany({data:positions,skipDuplicates:true});
  results.push({symbol:config.symbol,newTrades:tradeResult.count,newPnls:pnlResult.count});
 }
 console.log("Strategy history seed completed",JSON.stringify(results));
}finally{await prisma.$disconnect();}
