// Run only in a controlled environment: node scripts/seed-staff-rbac.mjs
// Does not create or assign any administrator accounts.
import {PrismaClient} from "@prisma/client";
const db=new PrismaClient();
const permissions=["account:access","portfolio:read:own","wallet:read:own","deposits:create:own","withdrawals:create:own","allocations:create:own","users:read","users:write","deposits:read","withdrawals:read","balances:read","wallets:read","wallets:operate","roles:read","roles:manage","audit:read"];
const roleGrants={
 user:["account:access","portfolio:read:own","wallet:read:own","deposits:create:own","withdrawals:create:own","allocations:create:own"],
 auditor:["users:read","deposits:read","withdrawals:read","balances:read","wallets:read","roles:read","audit:read"],
 support:["users:read","deposits:read","withdrawals:read","balances:read","wallets:read"],
 operations:["users:read","users:write","deposits:read","withdrawals:read","wallets:read","wallets:operate"],
 finance:["deposits:read","withdrawals:read","balances:read","audit:read"],
 "super-admin":permissions
};
try{
 await db.$transaction(async tx=>{
 // Remove deprecated manual-balance privilege if this script is rerun.
 const obsolete=await tx.permission.findUnique({where:{key:"balances:adjust"}});
 if(obsolete){await tx.rolePermission.deleteMany({where:{permissionId:obsolete.id}});await tx.permission.delete({where:{id:obsolete.id}});}
 for(const key of permissions)await tx.permission.upsert({where:{key},create:{key},update:{}});
 for(const [key,grants] of Object.entries(roleGrants)){
 const role=await tx.role.upsert({where:{key},create:{key},update:{}});
 for(const permission of grants){
 const item=await tx.permission.findUniqueOrThrow({where:{key:permission}});
 await tx.rolePermission.upsert({where:{roleId_permissionId:{roleId:role.id,permissionId:item.id}},create:{roleId:role.id,permissionId:item.id},update:{}});
 }
 }
 });
 console.log("Staff permissions and role templates seeded. No staff users assigned.");
}finally{await db.$disconnect()}
