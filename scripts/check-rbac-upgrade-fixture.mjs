// Raw SQL fixtures deliberately work against both old Staff* and unified Role tables.
import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
if(!process.env.DATABASE_URL?.includes("zenvest_ci")||process.env.NODE_ENV!=="test")
 throw Error("RBAC upgrade fixture requires disposable zenvest_ci test database");
const db=new PrismaClient();
const userId="ci_rbac_preupgrade_user",legacyAdminId="ci_rbac_preupgrade_admin",roleId="ci_rbac_preupgrade_role",permissionId="ci_rbac_preupgrade_permission";
const mode=process.argv[2];
try{
 if(mode==="seed"){
  const oldRole=await db.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='role'`);
  assert.equal(oldRole.length,1,"pre-upgrade users.role must still exist");
  await db.$executeRawUnsafe(`INSERT INTO "users" ("id","email","name","password_hash","updated_at") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)`,userId,"ci-rbac-preupgrade@example.invalid","Legacy RBAC user","disabled");
  // The historical ADMIN enum must not silently produce a new super-admin grant.
  await db.$executeRawUnsafe(`INSERT INTO "users" ("id","email","name","password_hash","role","updated_at") VALUES ($1,$2,$3,$4,'ADMIN',CURRENT_TIMESTAMP)`,legacyAdminId,"ci-rbac-legacy-admin@example.invalid","Legacy ADMIN account","disabled");
  await db.$executeRawUnsafe(`INSERT INTO "StaffRole" ("id","key") VALUES ($1,$2)`,roleId,"ci-preupgrade-operations");
  await db.$executeRawUnsafe(`INSERT INTO "StaffPermission" ("id","key") VALUES ($1,$2)`,permissionId,"ci-preupgrade:read");
  await db.$executeRawUnsafe(`INSERT INTO "StaffRolePermission" ("roleId","permissionId") VALUES ($1,$2)`,roleId,permissionId);
  await db.$executeRawUnsafe(`INSERT INTO "StaffRoleMembership" ("userId","roleId","assignedBy") VALUES ($1,$2,$3)`,userId,roleId,"ci-legacy-actor");
  console.log("Pre-cutover investor and ADMIN users, staff role, permission, grant and membership inserted");
 }else if(mode==="verify"){
  const membership=await db.userRole.findUniqueOrThrow({where:{userId_roleId:{userId,roleId}},include:{role:{include:{grants:{include:{permission:true}}}}}});
  assert.equal(membership.assignedBy,"ci-legacy-actor","original assignment provenance survives");
  assert.equal(membership.role.key,"ci-preupgrade-operations","original role ID and key survive");
  assert.deepEqual(membership.role.grants.map(x=>x.permission.key),["ci-preupgrade:read"],"permission ID and staff grant survive");
  assert.equal(membership.role.grants[0].permissionId,permissionId);
  assert.equal(await db.userRole.count({where:{userId,role:{key:"user"}}}),1,"existing account gains exactly one baseline membership");
  const adminMemberships=await db.userRole.findMany({where:{userId:legacyAdminId},include:{role:{include:{grants:{include:{permission:true}}}}}});
  assert.deepEqual(adminMemberships.map(m=>m.role.key),["user"],"legacy ADMIN label does not silently confer staff privileges");
  const adminKeys=new Set(adminMemberships.flatMap(m=>m.role.grants.map(g=>g.permission.key)));
  assert.ok(adminKeys.has("account:access"),"legacy ADMIN retains baseline account access");
  for(const privileged of ["roles:manage","users:write","wallets:operate","withdrawals:approve"])
   assert.ok(!adminKeys.has(privileged),"legacy ADMIN must not auto-gain "+privileged);
  await db.user.delete({where:{id:legacyAdminId}});
  await db.userRole.delete({where:{userId_roleId:{userId,roleId}}});
  await db.rolePermission.delete({where:{roleId_permissionId:{roleId,permissionId}}});
  await db.role.delete({where:{id:roleId}});
  await db.permission.delete({where:{id:permissionId}});
  await db.user.delete({where:{id:userId}});
  console.log("RBAC legacy ADMIN privilege isolation and existing staff grant preservation passed");
 }else throw Error("Pass seed or verify");
}finally{await db.$disconnect();}
