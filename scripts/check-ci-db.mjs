import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
const prisma=new PrismaClient();
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw new Error("Refusing to inspect non-CI database");
try {
 const user=await prisma.user.findUniqueOrThrow({where:{id:"ci_test_user"}});
 assert.equal(user.role,"USER");
 assert.equal(user.unallocated,123_000_000n);
 const position=await prisma.investorPosition.findUniqueOrThrow({where:{id:"ci_test_position"},include:{strategy:true}});
 assert.equal(position.strategy.name,"CI Test Strategy");
 assert.equal(position.principalUsdcMicros,25_000_000n);
 const buckets=await prisma.treasury.findMany({orderBy:{kind:"asc"}});
 assert.equal(buckets.length,6);
 assert.deepEqual(buckets.map(x=>x.kind).sort(),["ALLOCATE","DEPOSIT","DEPOSIT_FEE","K_BANK","M_BANK","WITHDRAWAL_FEE"].sort());
 const schemaTables=await prisma.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
 const tableNames=new Set(schemaTables.map(x=>x.tablename));
 for(const name of ["users","deposits","user_wallets","withdrawals","positions","strategy_trades","strategies","treasuries","treasury_transactions"])assert.ok(tableNames.has(name),name);
 for(const obsolete of ["investor_portfolios","master_wallet_balances","bot_status","active_bot_trade","withdrawal_deallocations"])assert.ok(!tableNames.has(obsolete),obsolete);
 await assert.rejects(()=>prisma.treasury.create({data:{kind:"DEPOSIT",source:"MASTER_WALLET",amount:1n,walletAddress:"ci",walletId:"ci"}}),e=>e.code==="P2002");
 console.log("CI PostgreSQL migration, fixtures and uniqueness assertions passed");
}finally{await prisma.$disconnect();}
