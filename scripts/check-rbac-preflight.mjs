// Read-only inspection of the legacy Staff* schema before unified RBAC migration.
// No schema changes, seeds, privilege grants or account modifications are permitted.
import {PrismaClient} from "@prisma/client";

const db=new PrismaClient();
const allowed=[
 "account:access","portfolio:read:own","wallet:read:own",
 "deposits:create:own","withdrawals:create:own","allocations:create:own"
];
try {
 const report=await db.$transaction(async tx=>{
  // Enforce read-only at PostgreSQL transaction level, not just by convention.
  await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
  const tables=await tx.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename IN ('StaffRole','StaffPermission','StaffRolePermission','StaffRoleMembership')`);
  const legacy=await tx.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='users' AND column_name='role'`);
  if(tables.length!==4||legacy.length!==1)
   throw Error("Expected pre-cutover Staff* tables and legacy users.role; refuse wrong migration stage");
  const orphan=await tx.$queryRawUnsafe(`
   SELECT COUNT(*)::int AS count FROM "StaffRoleMembership" m
   LEFT JOIN "users" u ON u.id=m."userId" WHERE u.id IS NULL`);
  const baselineExtra=await tx.$queryRawUnsafe(`
   SELECT p.key FROM "StaffRole" r JOIN "StaffRolePermission" g ON g."roleId"=r.id
   JOIN "StaffPermission" p ON p.id=g."permissionId"
   WHERE r.key='user' AND NOT (p.key = ANY($1::text[]))`,allowed);
  const collision=await tx.$queryRawUnsafe(`
   SELECT COUNT(*)::int AS count FROM "StaffRole"
   WHERE id='rbac_user_baseline' AND key<>'user'`);
  const permissionCollision=await tx.$queryRawUnsafe(`
   SELECT COUNT(*)::int AS count FROM "StaffPermission"
   WHERE (id,key) IN (
    ('rbac_account_access','account:access'),
    ('rbac_portfolio_own','portfolio:read:own'),
    ('rbac_wallet_own','wallet:read:own'),
    ('rbac_deposits_own','deposits:create:own'),
    ('rbac_withdrawals_own','withdrawals:create:own'),
    ('rbac_allocations_own','allocations:create:own')
   )`);
  const conflictingIds=await tx.$queryRawUnsafe(`
   SELECT COUNT(*)::int AS count FROM "StaffPermission"
   WHERE id IN ('rbac_account_access','rbac_portfolio_own','rbac_wallet_own',
    'rbac_deposits_own','rbac_withdrawals_own','rbac_allocations_own')
   AND (id,key) NOT IN (
    ('rbac_account_access','account:access'),
    ('rbac_portfolio_own','portfolio:read:own'),
    ('rbac_wallet_own','wallet:read:own'),
    ('rbac_deposits_own','deposits:create:own'),
    ('rbac_withdrawals_own','withdrawals:create:own'),
    ('rbac_allocations_own','allocations:create:own')
   )`);
  const accounts=await tx.$queryRawUnsafe(`SELECT role::text AS role,COUNT(*)::int AS count FROM "users" GROUP BY role`);
  return {orphan:orphan[0].count,baselineExtra:baselineExtra.map(x=>x.key),
   collision:collision[0].count,conflictingIds:conflictingIds[0].count,
   existingBaselineIds:permissionCollision[0].count,legacyAccountCounts:accounts};
 });
 console.log("RBAC legacy preflight (read only): "+JSON.stringify(report));
 if(report.orphan||report.baselineExtra.length||report.collision||report.conflictingIds)
  throw Error("Unsafe legacy RBAC state: reconcile orphan memberships, baseline grants or seed ID collisions before cutover");
 console.log("RBAC legacy preflight passed. This is NOT production migration approval.");
}finally{await db.$disconnect();}
