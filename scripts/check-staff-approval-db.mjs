import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
if(!process.env.DATABASE_URL?.includes("zenvest_ci"))throw Error("Refusing to run outside disposable CI database");
const db=new PrismaClient();
const prefix="ci_staff_approvals_";
try{
 const [requester,checker]=await Promise.all(["maker","checker"].map((suffix)=>db.user.create({data:{id:prefix+suffix,email:prefix+suffix+"@example.invalid",name:"CI staff",passwordHash:"not-a-login"}})));
 const role=await db.role.create({data:{key:prefix+"finance"}});
 const perm=await db.permission.create({data:{key:prefix+"wallets:operate"}});
 await db.rolePermission.create({data:{roleId:role.id,permissionId:perm.id}});
 await db.userRole.create({data:{userId:checker.id,roleId:role.id,assignedBy:requester.id}});
 const grant=await db.userRole.findUniqueOrThrow({where:{userId_roleId:{userId:checker.id,roleId:role.id}},include:{role:{include:{grants:{include:{permission:true}}}}}});
 assert.equal(grant.role.grants[0].permission.key,perm.key,"permissions must resolve through persisted memberships");
 const request=await db.$transaction(async(tx)=>{
  const action=await tx.staffAction.create({data:{resource:"wallets",operation:"operate",targetId:requester.id,payload:{},reason:"PostgreSQL maker-checker test",requestedBy:requester.id,idempotencyKey:prefix+"idempotency"}});
  await tx.staffAudit.create({data:{actorId:requester.id,action:"proposed",resource:"wallets",targetId:requester.id}});
  return action;
 });
 assert.equal(request.status,"PENDING");
 await assert.rejects(db.staffAction.create({data:{resource:"wallets",operation:"operate",targetId:requester.id,payload:{},reason:"Duplicate should fail",requestedBy:requester.id,idempotencyKey:prefix+"idempotency"}}),e=>e.code==="P2002","database must reject duplicate action keys");
 const decisions=await Promise.allSettled(Array.from({length:4},(_,index)=>db.$transaction(async(tx)=>{
  const updated=await tx.staffAction.updateMany({where:{id:request.id,status:"PENDING"},data:{status:index%2?"REJECTED":"APPROVED",decidedBy:checker.id,decidedAt:new Date()}});
  if(updated.count===1)await tx.staffAudit.create({data:{actorId:checker.id,action:"decision",resource:"wallets",targetId:requester.id}});
  return updated.count;
 })));
 const completed=decisions.filter(x=>x.status==="fulfilled").reduce((n,x)=>n+x.value,0);
 assert.equal(completed,1,"exactly one concurrent reviewer should win pending-state transition");
 const stored=await db.staffAction.findUniqueOrThrow({where:{id:request.id}});
 assert.ok(["APPROVED","REJECTED"].includes(stored.status));
 assert.equal(stored.decidedBy,checker.id);
 assert.equal(await db.staffAudit.count({where:{actorId:checker.id,action:"decision"}}),1,"exactly one decision audit record");
 assert.equal((await db.user.findUniqueOrThrow({where:{id:requester.id}})).unallocated,0n,"approval must not mutate balances");
 assert.equal(await db.staffAction.updateMany({where:{id:request.id,status:"PENDING"},data:{status:"APPROVED"}}).then(x=>x.count),0,"second decision must be denied");
 console.log("PostgreSQL staff grants, idempotency, review race, audit and non-execution passed");
}finally{
 await db.staffAudit.deleteMany({where:{targetId:{startsWith:prefix}}});
 await db.staffAction.deleteMany({where:{targetId:{startsWith:prefix}}});
 await db.userRole.deleteMany({where:{userId:{startsWith:prefix},role:{key:{not:"user"}}}});
 await db.rolePermission.deleteMany({where:{role:{key:{startsWith:prefix}}}});
 await db.role.deleteMany({where:{key:{startsWith:prefix}}});
 await db.permission.deleteMany({where:{key:{startsWith:prefix}}});
 await db.user.deleteMany({where:{id:{startsWith:prefix}}});
 await db.$disconnect();
}
