import {requireUser} from "@/lib/access";
import {prisma} from "@/lib/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const csv=(value:string)=>'"'+value.replace(/"/g,'""').replace(/^[=+@-]/,"'$&")+'"';
const usdc=(n:bigint)=>{const sign=n<0n?"-":"";const abs=n<0n?-n:n;return sign+(abs/1000000n)+'.'+(abs%1000000n).toString().padStart(6,"0");};
export async function GET(){
 const user=await requireUser();
 const data=await prisma.positionTradePnl.findMany({where:{userId:user.id,status:"SETTLED"},
  include:{strategyTrade:{select:{marketTradeName:true,marketTradeId:true}}},
  orderBy:[{settledAt:"asc"},{id:"asc"}],take:10000});
 const lines=["settled_utc,position_id,trade_id,market_event,eligible_usdc,gross_pnl_usdc,platform_fee_usdc,net_pnl_usdc"];
 for(const row of data)lines.push([
  csv(row.settledAt?.toISOString()??""),csv(row.positionId),csv(row.strategyTradeId),
  csv(row.strategyTrade.marketTradeName),usdc(row.eligibleCapitalUsdcMicros),
  usdc(row.grossPnlUsdcMicros??0n),usdc(row.platformFeeUsdcMicros??0n),usdc(row.netPnlUsdcMicros??0n)
 ].join(","));
 return new Response(lines.join("\n")+"\n",{headers:{"Content-Type":"text/csv; charset=utf-8",
  "Content-Disposition":'attachment; filename="zenvest-trade-pnl.csv"',"Cache-Control":"private, no-store"}});
}
