import { PrismaClient } from "@prisma/client";
const prisma=new PrismaClient();
const email=process.env.SEED_SANDBOX_EMAIL?.trim().toLowerCase();
if (!email) { console.error("Set SEED_SANDBOX_EMAIL to an existing verified investor's email."); process.exitCode=1; }
else {
 try {
  const user=await prisma.user.findUnique({where:{email},select:{id:true,role:true,emailVerifiedAt:true}});
  if (!user || user.role!=="INVESTOR" || !user.emailVerifiedAt) throw new Error("Verified investor not found; seed refused");
  const existing=await prisma.investorPortfolio.findUnique({where:{userId:user.id}});
  if (existing && (existing.depositedUsdcMicros!==0n || existing.allocatedUsdcMicros!==0n || existing.unallocatedUsdcMicros!==0n || existing.realizedPnlUsdcMicros!==0n || existing.depositedKobo!==0n || existing.allocatedKobo!==0n || existing.unallocatedKobo!==0n || existing.realizedPnlKobo!==0n)) throw new Error("Nonempty portfolio: refused to overwrite");
  await prisma.investorPortfolio.upsert({
   where:{userId:user.id},
   create:{userId:user.id,mode:"SANDBOX",depositedUsdcMicros:250_000_000n,allocatedUsdcMicros:150_000_000n,unallocatedUsdcMicros:100_000_000n,realizedPnlUsdcMicros:12_500_000n,pendingDepositsUsdcMicros:50_000_000n,pendingWithdrawalsUsdcMicros:0n},
   update:{mode:"SANDBOX",depositedUsdcMicros:250_000_000n,allocatedUsdcMicros:150_000_000n,unallocatedUsdcMicros:100_000_000n,realizedPnlUsdcMicros:12_500_000n,pendingDepositsUsdcMicros:50_000_000n,pendingWithdrawalsUsdcMicros:0n},
  });
  console.log("Seeded an existing verified investor's SANDBOX portfolio. No live balances changed.");
 }catch(error){console.error(error instanceof Error?error.message:"Seed failed");process.exitCode=1;}
 finally{await prisma.$disconnect();}
}
