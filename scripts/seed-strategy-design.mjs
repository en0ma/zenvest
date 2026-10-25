import {PrismaClient} from "@prisma/client";

// Runs on the production database after migrations. Only creates presentation
// strategies and presentation history; never writes real trade, position,
// investor, treasury, or custody records.
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
try{
 const summary=await prisma.$transaction(async tx=>{
  const counts=[];
  for(const strategy of catalogs){
   const existing=await tx.strategy.findUnique({where:{id:strategy.id},select:{id:true,symbol:true,isShowcase:true}});
   if(existing&&!existing.isShowcase)throw new Error("Refusing to change an existing operational strategy: "+strategy.id);
   if(existing&&existing.symbol!==strategy.symbol)throw new Error("Strategy symbol collision: "+strategy.id);
   if(!existing)await tx.strategy.create({data:{
    id:strategy.id,name:strategy.name,symbol:strategy.symbol,logo:strategy.logo,
    description:strategy.description,note:strategy.note,marketType:strategy.marketType,
    isShowcase:true,displayAllocationUsdcMicros:strategy.capital,
    isActive:false,isPublic:true,status:"OFFLINE",
    minCapacityUsdcMicros:0n,maxCapacityUsdcMicros:0n,availableCapacityUsdcMicros:0n,
    minAllocationUsdcMicros:0n,maxAllocationUsdcMicros:0n
   }});
   const rows=[];
   for(let day=59;day>=0;day--)for(let step=0;step<2;step++){
    const stamp=new Date(anchor.getTime()-day*86400000+(step===0?-14400000:10800000));
    const positive=rand()<.76;
    const amplitude=(.0003+rand()*.0024)*strategy.bias;
    const pnl=BigInt(Math.round(Number(strategy.capital)*amplitude*(positive?1:-1)));
    rows.push({id:"design_"+strategy.id+"_"+day+"_"+step,strategyId:strategy.id,
     occurredAt:stamp,netPnlUsdcMicros:pnl,eligibleCapitalUsdcMicros:strategy.capital});
   }
   const created=await tx.strategyDisplayTrade.createMany({data:rows,skipDuplicates:true});
   counts.push({symbol:strategy.symbol,created:created.count});
  }
  return counts;
 },{timeout:120000});
 console.log("Strategy market presentation data ready:",JSON.stringify(summary));
}finally{await prisma.$disconnect();}
