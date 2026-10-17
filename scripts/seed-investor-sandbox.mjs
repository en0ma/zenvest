import { PrismaClient } from "@prisma/client";
const prisma=new PrismaClient();
const email=process.env.SEED_SANDBOX_EMAIL?.trim().toLowerCase();
if (!email) { console.error("Set SEED_SANDBOX_EMAIL to an existing verified investor's email."); process.exitCode=1; }
else {
 try {
  const user=await prisma.user.findUnique({where:{email},select:{id:true,role:true,emailVerifiedAt:true}});
  if (!user || user.role!=="INVESTOR" || !user.emailVerifiedAt) throw new Error("Verified investor not found; seed refused");
  const existing=await prisma.investorPortfolio.findUnique({where:{userId:user.id}});
  if (existing && (existing.depositedKobo!==0n || existing.allocatedKobo!==0n || existing.unallocatedKobo!==0n || existing.realizedPnlKobo!==0n)) throw new Error("Nonempty portfolio: refused to overwrite");
  await prisma.investorPortfolio.upsert({
   where:{userId:user.id},
   create:{userId:user.id,mode:"SANDBOX",depositedKobo:25000000n,allocatedKobo:15000000n,unallocatedKobo:10000000n,realizedPnlKobo:1250000n,pendingDepositsKobo:5000000n,pendingWithdrawalsKobo:0n},
   update:{mode:"SANDBOX",depositedKobo:25000000n,allocatedKobo:15000000n,unallocatedKobo:10000000n,realizedPnlKobo:1250000n,pendingDepositsKobo:5000000n,pendingWithdrawalsKobo:0n},
  });
  console.log("Seeded an existing verified investor's SANDBOX portfolio. No live balances changed.");
 }catch(error){console.error(error instanceof Error?error.message:"Seed failed");process.exitCode=1;}
 finally{await prisma.$disconnect();}
}
