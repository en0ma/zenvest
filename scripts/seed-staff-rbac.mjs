// Run only in a controlled environment: node scripts/seed-staff-rbac.mjs
// Does not create or assign any administrator accounts.
import {PrismaClient} from "@prisma/client";
import {STAFF_PERMISSION_DESCRIPTIONS} from "../src/lib/staff-permissions.ts";
const db=new PrismaClient();
const permissions=["account:access","portfolio:read:own","wallet:read:own","deposits:create:own","withdrawals:create:own","allocations:create:own","users:read","users:write","deposits:read","withdrawals:read","balances:read","wallets:read","wallets:operate","roles:read","roles:manage","audit:read","bots:manage:own"];
const roleGrants={
 user:["account:access","portfolio:read:own","wallet:read:own","deposits:create:own","withdrawals:create:own","allocations:create:own"],
 bot:["bots:manage:own"],
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
 for(const key of permissions){
 const description=STAFF_PERMISSION_DESCRIPTIONS[key];
 await tx.permission.upsert({where:{key},create:{key,description},update:{description}});
 }
 for(const [key,grants] of Object.entries(roleGrants)){
 const existing=await tx.role.findUnique({where:{key}});
 const role=existing??await tx.role.create({data:{key}});
 // Existing role edits belong to the Super Admin UI. Never re-add removed
 // grants on an existing editable role when the seed command is rerun.
 if(existing&&key!=="user"&&key!=="super-admin")continue;
 for(const permission of grants){
 const item=await tx.permission.findUniqueOrThrow({where:{key:permission}});
 await tx.rolePermission.upsert({where:{roleId_permissionId:{roleId:role.id,permissionId:item.id}},create:{roleId:role.id,permissionId:item.id},update:{}});
 }
 }
 });
 console.log("Staff permissions and role templates seeded. No staff users assigned.");
}finally{await db.$disconnect()}
