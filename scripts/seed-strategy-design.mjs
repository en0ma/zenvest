import {PrismaClient} from "@prisma/client";
import {createHash} from "node:crypto";

// Populate an isolated design database only. Never inject generated P&L into
// real investor ledgers or an environment with production custody.
const url=process.env.DATABASE_URL??"";
let target;
try{target=new URL(url);}catch{throw new Error("DATABASE_URL must be configured");}
const database=decodeURIComponent(target.pathname.replace(/^\//,"")).toLowerCase();
if(process.env.NODE_ENV==="production"||process.env.VERCEL_ENV==="production"||
   !/^(zenvest_(dev|design|ci|preview)|zenvest-(dev|design|ci|preview))$/.test(database)||
   process.env.SEED_DESIGN_ACK!=="isolated-design-database"){
 throw new Error("Refusing design data outside an explicitly acknowledged isolated design database");
}
const email=process.env.SEED_DESIGN_EMAIL?.trim().toLowerCase();
if(!email)throw new Error("Set SEED_DESIGN_EMAIL to a verified account in the isolated design database");

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
const microsPerUsdc=1000000n;
const anchor=new Date();anchor.setUTCHours(12,0,0,0);
try{
 const user=await prisma.user.findUnique({where:{email},select:{id:true,emailVerifiedAt:true}});
 if(!user?.emailVerifiedAt)throw new Error("Design investor must exist and have a verified email");
 const result=await prisma.$transaction(async tx=>{
  // Existing market IDs are private to this isolated environment. Refuse to
  // overwrite or silently reprice an unrelated strategy.
  for(const config of catalogs){
   const existing=await tx.strategy.findUnique({where:{id:config.id},select:{id:true,symbol:true}});
   if(existing&&existing.symbol!==config.symbol)throw new Error("Strategy ID collision: "+config.id);
   await tx.strategy.upsert({where:{id:config.id},create:{
    id:config.id,name:config.name,symbol:config.symbol,logo:config.logo,
    description:config.description,note:config.note,marketType:config.marketType,
    isActive:true,isPublic:true,status:"TRADING",
    minCapacityUsdcMicros:1000000000n,maxCapacityUsdcMicros:100000000000n,
    availableCapacityUsdcMicros:65000000000n,
    minAllocationUsdcMicros:100000000n,maxAllocationUsdcMicros:50000000000n
   },update:{name:config.name,symbol:config.symbol,logo:config.logo,description:config.description,
    note:config.note,marketType:config.marketType,isActive:true,isPublic:true,status:"TRADING"}});
  }
  let trades=0;const counts=[];
  for(let index=0;index<catalogs.length;index++){
   const strategy=catalogs[index];
   const positionId="c"+createHash("sha256").update("zenvest-design-position:"+strategy.id+":"+user.id).digest("hex").slice(0,24);
   const position=await tx.investorPosition.findUnique({where:{id:positionId}});
   if(position&&(position.userId!==user.id||position.strategyId!==strategy.id))
    throw new Error("Position collision: "+positionId);
   // We never overwrite pre-existing ledger values; repeated runs only
   // replace generated trade data under these deterministic IDs.
   if(!position)await tx.investorPosition.create({data:{id:positionId,userId:user.id,
    strategyId:strategy.id,allocatedUsdcMicros:strategy.capital,status:"OPEN"}});
   let settledTotal=0n;
   for(let day=59;day>=0;day--){
    for(let step=0;step<2;step++){
     const stamp=new Date(anchor.getTime()-day*86400000+(step===0?-14400000:10800000));
     const tradeId="design_"+strategy.id+"_"+day+"_"+step;
     const positive=rand()<.76;
     const amplitude=(.0003+rand()*.0024)*strategy.bias;
     const net=Math.round(Number(strategy.capital)*amplitude*(positive?1:-1));
     const netPnl=BigInt(net);
     settledTotal+=netPnl;
     const marketTradeName=["Session Alpha","Pricing Rotation","Event Spread","Momentum Signal","Liquidity Window","Risk-Adjusted Entry"][(day+step+index)%6];
     await tx.strategyTrade.upsert({where:{id:tradeId},create:{
      id:tradeId,strategyId:strategy.id,marketTradeId:tradeId,marketTradeName,
      status:"SETTLED",isPnlCalculated:true,eligibleCapitalUsdcMicros:strategy.capital,
      realizedPnlUsdcMicros:netPnl,marketStart:new Date(stamp.getTime()-3600000),
      marketEnd:stamp,createdAt:new Date(stamp.getTime()-3600000),settledAt:stamp
     },update:{marketTradeName,status:"SETTLED",isPnlCalculated:true,
      eligibleCapitalUsdcMicros:strategy.capital,realizedPnlUsdcMicros:netPnl,settledAt:stamp}});
     await tx.positionTradePnl.upsert({where:{strategyTradeId_positionId:{strategyTradeId:tradeId,positionId}},
      create:{strategyTradeId:tradeId,positionId,userId:user.id,eligibleCapitalUsdcMicros:strategy.capital,
       grossPnlUsdcMicros:netPnl,netPnlUsdcMicros:netPnl,platformFeeUsdcMicros:0n,
       status:"SETTLED",createdAt:new Date(stamp.getTime()-3600000),settledAt:stamp},
      update:{grossPnlUsdcMicros:netPnl,netPnlUsdcMicros:netPnl,
       eligibleCapitalUsdcMicros:strategy.capital,platformFeeUsdcMicros:0n,status:"SETTLED",settledAt:stamp}});
     trades++;
    }
   }
   if(!position)await tx.investorPosition.update({where:{id:positionId},
    data:{allocatedUsdcMicros:strategy.capital+settledTotal}});
   counts.push({symbol:strategy.symbol,trades:120,pnlUsdc:Number(settledTotal/microsPerUsdc)});
  }
  return {strategies:catalogs.length,trades,positions:catalogs.length,counts};
 },{timeout:180000});
 console.log("Design database populated:",JSON.stringify(result));
}finally{await prisma.$disconnect();}
