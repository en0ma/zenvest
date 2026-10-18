import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Future Kalshi integration entry point. Invoke ONLY after independently
// verifying funds are returned to master custody; never from a client request.
// This transition is idempotent and does not settle the associated withdrawal.
export async function confirmWithdrawalDeallocation(id:string) {
  return prisma.$transaction(async tx=>{
    const item=await tx.withdrawalDeallocation.findUnique({where:{id}});
    if(!item) throw new Error("Unknown deallocation");
    if(item.status==="COMPLETED") return false;
    if(item.status!=="PROCESSING") throw new Error("Deallocation not processing");
    const updated=await tx.withdrawalDeallocation.updateMany({
      where:{id,status:"PROCESSING"},data:{status:"COMPLETED",completedAt:new Date()},
    });
    if(updated.count!==1)return false;
    const moved=await tx.investorPortfolio.updateMany({
      where:{id:item.portfolioId,allocatedUsdcMicros:{gte:item.amountUsdcMicros}},
      data:{allocatedUsdcMicros:{decrement:item.amountUsdcMicros},
        unallocatedUsdcMicros:{increment:item.amountUsdcMicros}},
    });
    if(moved.count!==1)throw new Error("Allocated balance cannot cover deallocation");
    await tx.investorActivity.create({data:{
      portfolioId:item.portfolioId,type:"DEALLOCATION",amountKobo:0n,
      amountUsdcMicros:item.amountUsdcMicros,
      reference:`withdrawal-deallocation:${item.id}`,
      description:"Confirmed return of allocated USDC for withdrawal",
    }});
    console.info(JSON.stringify({component:"withdrawal-deallocation",
      outcome:"completed",userId:item.userId,deallocationId:id,withdrawalId:item.withdrawalId}));
    return true;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
