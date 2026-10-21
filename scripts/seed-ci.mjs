import { PrismaClient } from "@prisma/client";
const prisma=new PrismaClient();
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw new Error("Refusing to seed non-CI database");
try {
 await prisma.user.upsert({where:{email:"ci-fixture@zenvest.invalid"},create:{
   id:"ci_test_user",email:"ci-fixture@zenvest.invalid",name:"CI User",
   passwordHash:"ci-fixture-not-a-password",role:"USER",unallocated:123_000_000n,
 },update:{}});
 await prisma.strategy.upsert({where:{id:"ci_test_strategy"},create:{
  id:"ci_test_strategy",name:"CI Test Strategy",description:"Synthetic CI-only market data",
  isActive:false,isPublic:false,status:"OFFLINE",marketType:"PREDICTION",
 },update:{}});
 await prisma.investorPosition.upsert({where:{id:"ci_test_position"},create:{
  id:"ci_test_position",userId:"ci_test_user",strategyId:"ci_test_strategy",
  principalUsdcMicros:25_000_000n,status:"ACTIVE",
 },update:{}});
 for(const [kind,source,amount] of [
  ["DEPOSIT","MASTER_WALLET",123_000_000n],
  ["WITHDRAWAL_FEE","MASTER_WALLET",0n],
  ["DEPOSIT_FEE","MASTER_WALLET",0n],
  ["ALLOCATE","KALSHI",25_000_000n],
  ["M_BANK","MASTER_WALLET",0n],
  ["K_BANK","KALSHI",0n],
 ])await prisma.treasury.upsert({where:{kind},create:{kind,source,amount,walletAddress:"CI_TEST_ADDRESS",walletId:"CI_TEST_WALLET"},update:{}});
 console.log("CI-only fixture seeded");
}finally{await prisma.$disconnect();}
