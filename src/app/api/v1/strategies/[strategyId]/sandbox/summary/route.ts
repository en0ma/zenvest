import {prisma} from "@/lib/db";
import {authorizeBotV1} from "@/lib/bot-v1-access";
export const dynamic="force-dynamic";
type Context={params:Promise<{strategyId:string}>};
export async function GET(request:Request,{params}:Context){
 const {strategyId}=await params;
 const access=await authorizeBotV1(request,strategyId);
 if(!access.ok)return access.response;
 const [account,fills,positions]=await Promise.all([
  prisma.sandboxAccount.findUnique({where:{strategyId}}),
  prisma.sandboxFill.findMany({where:{strategyId},orderBy:{createdAt:"desc"},take:100,
   select:{id:true,eventId:true,orderType:true,side:true,quantity:true,priceMicros:true,realizedPnlMicros:true,
    estimatedFeeMicros:true,venueObservedAt:true,createdAt:true}}),
  prisma.sandboxPosition.findMany({where:{strategyId,quantity:{gt:0}}})
 ]);
 const held=positions.reduce((sum,p)=>sum+p.costBasisMicros,0n);
 return Response.json({strategy_id:strategyId,environment:"SANDBOX_ONLY",settlement_verified:false,
  virtual_cash_usdc_micros:(account?.cashMicros??10000000000n).toString(),
  cost_basis_equity_usdc_micros:((account?.cashMicros??10000000000n)+held).toString(),
  realized_virtual_pnl_usdc_micros:(account?.realizedPnlMicros??0n).toString(),
  unrealized_pnl_usdc_micros:null,
  max_realized_drawdown_bps:account?.maxDrawdownBps??0,
  recent_fills:fills.map(f=>({...f,priceMicros:f.priceMicros.toString(),
   realizedPnlMicros:f.realizedPnlMicros.toString(),estimatedFeeMicros:f.estimatedFeeMicros.toString()}))},
  open_virtual_positions:positions.map(p=>({...p,costBasisMicros:p.costBasisMicros.toString()}))
 },{headers:access.headers});
}
