import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {registerHooks} from "node:module";
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="server-only")return nextResolve(new URL("./ci-server-only-shim.mjs",import.meta.url).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",import.meta.url).href,context);
 if(specifier.startsWith("./")&&context.parentURL?.includes("/src/lib/")&&!/\.[cm]?[jt]s$/.test(specifier))return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("Disposable CI database required");
const {settleVerifiedStrategyReturn}=await import("../src/lib/strategy-return-settlement.ts");
const prisma=new PrismaClient();
const userId="ci_direct_return_user",strategyId="ci_direct_return_strategy",amount=3_000_001n;
let originalDeposit,originalAllocate,eventId,positionId;
try{
 const deposit=await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}});
 const allocate=await prisma.treasury.findUniqueOrThrow({where:{kind:"ALLOCATE"}});
 originalDeposit=deposit.amount;originalAllocate=allocate.amount;
 assert.ok(originalAllocate>=amount,"CI ALLOCATE fixture must cover verified return");
 await prisma.user.create({data:{id:userId,email:"ci-direct-return@example.invalid",name:"CI Direct Return",passwordHash:"ci-only"}});
 await prisma.strategy.create({data:{id:strategyId,name:"CI Direct Return Strategy",description:"Treasury return test",kalshiWalletAddress:"ci-kalshi-return-address",availableCapacityUsdcMicros:0n}});
 const position=await prisma.investorPosition.create({data:{userId,strategyId,status:"OPEN",allocatedUsdcMicros:0n}});
 positionId=position.id;
 const event=await prisma.strategyEvent.create({data:{strategyId,kind:"DEALLOCATE",status:"CONFIRMING",sourceConfirmed:true,kalshiWithdrawalId:"ci-kalshi-direct-withdrawal",amountUsdcMicros:amount}});
 eventId=event.id;
 await prisma.positionAllocation.create({data:{userId,strategyId,positionId,kind:"DEALLOCATE",strategyEventId:eventId,status:"CONFIRMING",amountUsdcMicros:amount}});
 const receipt={strategyEventId:eventId,kalshiWithdrawalId:"ci-kalshi-direct-withdrawal",masterReceiptId:"ci-master-return-receipt",
  kalshiWalletAddress:"ci-kalshi-return-address",masterWalletAddress:deposit.walletAddress,
  amountUsdcMicros:amount,asset:"USDC",network:"solana"};
 assert.equal(await settleVerifiedStrategyReturn({...receipt,amountUsdcMicros:amount+1n}),"mismatch",
  "unmatched custody amount cannot credit principal");
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}})).amount,originalDeposit);
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"ALLOCATE"}})).amount,originalAllocate);
 assert.equal(await settleVerifiedStrategyReturn(receipt),"completed");
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}})).amount,originalDeposit+amount,"verified return credits DEPOSIT");
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"ALLOCATE"}})).amount,originalAllocate-amount,"verified return debits ALLOCATE");
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated,amount,"investor credited exactly once");
 assert.equal((await prisma.treasury.findFirst({where:{kind:"DEALLOCATE"}})),null,"verified return cannot create legacy DEALLOCATE balance row");
 assert.equal((await prisma.positionAllocation.findFirstOrThrow({where:{strategyEventId:eventId}})).status,"COMPLETED");
 assert.equal((await prisma.strategyEvent.findUniqueOrThrow({where:{id:eventId}})).status,"COMPLETED");
 assert.equal((await prisma.treasuryTransfer.findFirstOrThrow({where:{reference:"strategy_return:"+eventId}})).direction,"DEALLOCATE",
  "historical transfer direction remains DEALLOCATE");
 assert.equal(await settleVerifiedStrategyReturn(receipt),"duplicate","repeat receipt is idempotent");
 assert.equal(await settleVerifiedStrategyReturn({...receipt,masterReceiptId:"other-receipt"}),"mismatch");
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"DEPOSIT"}})).amount,originalDeposit+amount);
 assert.equal((await prisma.treasury.findUniqueOrThrow({where:{kind:"ALLOCATE"}})).amount,originalAllocate-amount);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id:userId}})).unallocated,amount);
 console.log("Verified return accounting passed: ALLOCATE -> DEPOSIT, investor credit, no legacy bucket, replay/mismatch safety");
}finally{
 if(eventId){
  await prisma.investorActivity.deleteMany({where:{userId}});
  await prisma.positionAllocation.deleteMany({where:{strategyEventId:eventId}});
  await prisma.strategyEvent.deleteMany({where:{id:eventId}});
  await prisma.treasuryTransfer.deleteMany({where:{reference:"strategy_return:"+eventId}});
 }
 if(positionId)await prisma.investorPosition.deleteMany({where:{id:positionId}});
 await prisma.strategy.deleteMany({where:{id:strategyId}});
 await prisma.user.deleteMany({where:{id:userId}});
 if(originalDeposit!==undefined)await prisma.treasury.update({where:{kind:"DEPOSIT"},data:{amount:originalDeposit}});
 if(originalAllocate!==undefined)await prisma.treasury.update({where:{kind:"ALLOCATE"},data:{amount:originalAllocate}});
 await prisma.$disconnect();
}
