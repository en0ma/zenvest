import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("Disposable CI database required");
const db=new PrismaClient();
const prefix="ci_staff_lifecycle_";
const adminId=prefix+"admin",userId=prefix+"target";
try{
 await db.user.createMany({data:[
  {id:adminId,email:prefix+"admin@example.invalid",name:"Staff manager",passwordHash:"fixture"},
  {id:userId,email:prefix+"target@example.invalid",name:"Staff member",passwordHash:"fixture"}
 ]});
 const role=await db.role.create({data:{key:prefix+"support"}});
 const permission=await db.permission.create({data:{key:prefix+"users:read"}});
 await db.rolePermission.create({data:{roleId:role.id,permissionId:permission.id}});
 const before=await db.user.findUniqueOrThrow({where:{id:userId},select:{sessionVersion:true}});
 const assigned=await db.$transaction(async tx=>{
  const membership=await tx.userRole.create({data:{userId,roleId:role.id,assignedBy:adminId}});
  await tx.staffAudit.create({data:{actorId:adminId,action:"role.assigned:support",resource:"roles",targetId:userId}});
  return membership;
 });
 assert.equal(assigned.userId,userId);
 assert.equal(assigned.assignedBy,adminId);
 const roles=await db.userRole.findMany({where:{userId},include:{role:{include:{grants:{include:{permission:true}}}}}});
 assert.deepEqual(roles.find(x=>x.roleId===role.id)?.role.grants.map(x=>x.permission.key),[permission.key]);
 assert.equal(roles.some(x=>x.role.key==="user"),true,"every account has baseline role");
 await assert.rejects(db.userRole.create({data:{userId,roleId:role.id,assignedBy:adminId}}),e=>e.code==="P2002","one role membership per user and role");
 const revoked=await db.$transaction(async tx=>{
  const result=await tx.userRole.deleteMany({where:{userId,roleId:role.id}});
  assert.equal(result.count,1);
  await tx.user.update({where:{id:userId},data:{sessionVersion:{increment:1}}});
  await tx.staffAudit.create({data:{actorId:adminId,action:"role.revoked:support",resource:"roles",targetId:userId}});
  return result.count;
 });
 assert.equal(revoked,1);
 assert.equal(await db.userRole.count({where:{userId}}),1,"revoking staff keeps baseline user role");
 const after=await db.user.findUniqueOrThrow({where:{id:userId},select:{sessionVersion:true}});
 assert.equal(after.sessionVersion,before.sessionVersion+1);
 const audit=await db.staffAudit.findMany({where:{actorId:adminId,targetId:userId},orderBy:{createdAt:"asc"}});
 assert.equal(audit.length,2);
 assert.deepEqual(audit.map(x=>x.action).sort(),["role.assigned:support","role.revoked:support"]);
 assert.equal((await db.userRole.deleteMany({where:{userId,roleId:role.id}})).count,0);
 console.log("PostgreSQL staff membership, duplicate denial, revoke, session invalidation and audit passed");
}finally{
 try{
  await db.staffAudit.deleteMany({where:{targetId:userId}});
  await db.userRole.deleteMany({where:{userId}});
  await db.rolePermission.deleteMany({where:{role:{key:{startsWith:prefix}}}});
  await db.role.deleteMany({where:{key:{startsWith:prefix}}});
  await db.permission.deleteMany({where:{key:{startsWith:prefix}}});
  await db.user.deleteMany({where:{id:{startsWith:prefix}}});
 }finally{await db.$disconnect()}
}
