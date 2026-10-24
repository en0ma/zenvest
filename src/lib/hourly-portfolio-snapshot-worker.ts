import {Prisma} from "@prisma/client";
import {prisma} from "./db.ts";

export function utcHourBucket(date:Date):Date{
 if(!Number.isFinite(date.getTime()))throw new Error("Invalid snapshot time");
 return new Date(Math.floor(date.getTime()/3_600_000)*3_600_000);
}

/** Capture settled ledger equity, not speculative Kalshi mark-to-market values. */
export async function captureHourlyPortfolioSnapshots(now=new Date()){
 const snapshotAt=utcHourBucket(now);
 let cursor:string|undefined;
 let created=0,existing=0;
 const failures:string[]=[];
 do{
  const users=await prisma.user.findMany({select:{id:true},orderBy:{id:"asc"},
   ...(cursor?{cursor:{id:cursor},skip:1}:{}),take:100});
  if(users.length===0)break;
  for(const user of users){
   try{
    const outcome=await prisma.$transaction(async tx=>{
     const already=await tx.portfolioSnapshot.findUnique({where:{
      userId_snapshotAt:{userId:user.id,snapshotAt}},select:{id:true}});
     if(already)return "exists";
     const [account,positions,withdrawals,allocations,pnl]=await Promise.all([
      tx.user.findUniqueOrThrow({where:{id:user.id},select:{unallocated:true}}),
      tx.investorPosition.aggregate({where:{userId:user.id},_sum:{allocatedUsdcMicros:true}}),
      tx.investorWithdrawal.aggregate({where:{userId:user.id,status:{in:["PENDING","SUBMITTING","PROCESSING","REVIEW"]}},_sum:{grossUsdcMicros:true}}),
      tx.positionAllocation.aggregate({where:{userId:user.id,kind:"ALLOCATE",status:{in:["PENDING","SUBMITTING","PROCESSING","CONFIRMING","REVIEW"]}},_sum:{amountUsdcMicros:true}}),
      tx.positionTradePnl.aggregate({where:{userId:user.id,status:"SETTLED",
       settledAt:{lte:now}},_sum:{netPnlUsdcMicros:true}}),
     ]);
     const unallocated=account.unallocated,allocated=positions._sum.allocatedUsdcMicros??0n;
     const reserved=(withdrawals._sum.grossUsdcMicros??0n)+(allocations._sum.amountUsdcMicros??0n);
     if(unallocated<0n||allocated<0n||reserved<0n)throw new Error("Negative investor balance");
     await tx.portfolioSnapshot.create({data:{userId:user.id,snapshotAt,
      unallocatedUsdcMicros:unallocated,allocatedUsdcMicros:allocated,
      reservedUsdcMicros:reserved,portfolioValueUsdcMicros:unallocated+allocated,
      cumulativeRealizedPnlUsdcMicros:pnl._sum.netPnlUsdcMicros??0n}});
     return "created";
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:12000});
    if(outcome==="created")created++;else existing++;
   }catch(error){
    // One failed investor must not prevent other hourly snapshots.
    // Retrying this hour is safe due to the (user_id, snapshot_at) key.
    failures.push(user.id);
    console.error(JSON.stringify({component:"hourly-portfolio-snapshot",
     errorType:error instanceof Error?error.name:"unknown"}));
   }
  }
  cursor=users[users.length-1].id;
  if(users.length<100)break;
 }while(true);
 return {snapshotAt:snapshotAt.toISOString(),created,existing,failed:failures.length,
  // Don't expose investor identifiers from the cron response.
  retryNeeded:failures.length>0};
}
