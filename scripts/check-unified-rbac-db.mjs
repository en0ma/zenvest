import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("Disposable CI DB required");
const db=new PrismaClient();
const userId="ci_unified_rbac_user",roleKey="ci_unified_support",permissionKey="ci_unified_read";
let roleId=null,permissionId=null;
try{
 const oldRoleColumn=await db.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='role'");
 assert.equal(oldRoleColumn.length,0,"legacy USER ADMIN discriminator must not exist");
 const tables=await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public'");
 for(const name of ["Role","Permission","RolePermission","UserRole"])assert.ok(tables.some(row=>row.tablename===name),name+" must be a real RBAC table");
 const created=await db.user.create({data:{id:userId,name:"Unified RBAC CI",email:"ci-unified-rbac@example.invalid",passwordHash:"disabled"}});
 assert.equal(created.id,userId);
 const initial=await db.userRole.findMany({where:{userId},include:{role:{include:{grants:{include:{permission:true}}}}}});
 assert.equal(initial.length,1,"registration/database insertion assigns baseline once");
 assert.equal(initial[0].role.key,"user");
 const allowed=new Set(initial[0].role.grants.map(g=>g.permission.key));
 for(const key of ["account:access","portfolio:read:own","wallet:read:own","deposits:create:own","withdrawals:create:own","allocations:create:own"])assert.ok(allowed.has(key),key);
 for(const key of ["roles:manage","wallets:operate","withdrawals:approve","deposits:reconcile","balances:adjust"])assert.ok(!allowed.has(key),"baseline must never have privileged permission "+key);
 for(const key of ["deposits:reconcile","withdrawals:approve"])assert.equal(await db.permission.count({where:{key}}),0,"retired admin financial permission must not survive migration");
 for(const [resource,operation] of [["deposits","reconcile"],["withdrawals","approve"]]){
  await assert.rejects(db.staffAction.create({data:{resource,operation,targetId:userId,reason:"Retired admin operation blocked",requestedBy:userId,idempotencyKey:"ci_denied_"+resource,payload:{}}}),"database must forbid retired staff action "+resource);
 }
 roleId=(await db.role.create({data:{key:roleKey}})).id;
 permissionId=(await db.permission.create({data:{key:permissionKey}})).id;
 await db.rolePermission.create({data:{roleId,permissionId}});
 await db.userRole.create({data:{userId,roleId,assignedBy:"ci-test-admin"}});
 const combined=await db.userRole.findMany({where:{userId},include:{role:{include:{grants:{include:{permission:true}}}}}});
 const union=new Set(combined.flatMap(x=>x.role.grants.map(g=>g.permission.key)));
 assert.ok(union.has("account:access")&&union.has(permissionKey),"staff membership adds, never replaces baseline");
 await assert.rejects(()=>db.userRole.deleteMany({where:{userId,role:{key:"user"}}}),"baseline cannot be manually revoked");
 assert.equal((await db.userRole.findMany({where:{userId,role:{key:"user"}}})).length,1);
 // The mandatory baseline role itself must not be renamed or deleted: either
 // operation would orphan the logical investor role despite intact memberships.
 const baselineRole=await db.role.findUniqueOrThrow({where:{key:"user"}});
 await assert.rejects(()=>db.role.update({where:{id:baselineRole.id},data:{key:"disabled-user"}}),
  /Cannot modify the mandatory baseline user role/,"baseline role must not be renamed");
 await assert.rejects(()=>db.role.delete({where:{id:baselineRole.id}}),
  /Cannot modify the mandatory baseline user role/,"baseline role must not be deleted");
 assert.equal((await db.role.findUniqueOrThrow({where:{id:baselineRole.id}})).key,"user");
 await db.userRole.delete({where:{userId_roleId:{userId,roleId}}});
 assert.equal(await db.userRole.count({where:{userId}}),1,"revoked staff role retains baseline");
 await assert.rejects(()=>db.userRole.create({data:{userId:"ci_nonexistent_unified_account",roleId,assignedBy:"ci-test"}}),"memberships cannot refer to missing users");
 await db.user.delete({where:{id:userId}});
 assert.equal(await db.userRole.count({where:{userId}}),0,"account deletion cleans memberships by FK cascade");
 console.log("Unified RBAC PostgreSQL: baseline auto-assignment, inherited privileges, no legacy role, protected baseline and FK integrity passed");
}finally{
 await db.user.deleteMany({where:{id:userId}});
 if(roleId){await db.userRole.deleteMany({where:{roleId}});await db.rolePermission.deleteMany({where:{roleId}});await db.role.deleteMany({where:{id:roleId}});}
 if(permissionId)await db.permission.deleteMany({where:{id:permissionId}});
 await db.$disconnect();
}
