import type {NextRequest} from "next/server";
import {Prisma} from "@prisma/client";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {requireStaffPermission} from "@/lib/staff-access";
import {staffWriteError} from "@/lib/staff-write-error";
import {EDITABLE_ROLE_PERMISSIONS,ROLE_KEY_PATTERN,validateRoleGrants} from "@/lib/staff-role-editor-policy";
export const dynamic="force-dynamic";
const roleInput=z.object({
 roleKey:z.string().regex(ROLE_KEY_PATTERN),
 permissionKeys:z.array(z.string()).max(EDITABLE_ROLE_PERMISSIONS.length)
}).strict();
async function onlySuperAdmin(actor:string){
 return Boolean(await prisma.userRole.findFirst({where:{userId:actor,role:{key:"super-admin"}},select:{userId:true}}));
}
export async function GET(){
 try{
  const actor=await requireStaffPermission("roles:manage");
  if(!await onlySuperAdmin(actor))return Response.json({error:"Super Admin required"},{status:403});
  const [roles,permissions]=await Promise.all([prisma.role.findMany({orderBy:{key:"asc"},include:{grants:{include:{permission:true}},_count:{select:{members:true}}}}),prisma.permission.findMany({where:{key:{in:[...EDITABLE_ROLE_PERMISSIONS]}},select:{key:true,description:true}})]);
  return Response.json({roles:roles.map(role=>({key:role.key,editable:role.key!=="user"&&role.key!=="super-admin",
   permissionKeys:role.grants.map(g=>g.permission.key).sort(),memberCount:role._count.members})),
   editablePermissions:permissions},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return staffWriteError(error)}
}
async function writeRole(request:NextRequest,create:boolean){
 try{
  const actor=await requireStaffPermission("roles:manage",{requireFreshLogin:true});
  const parsed=roleInput.safeParse(await request.json());
  if(!parsed.success||!validateRoleGrants(parsed.data.roleKey,parsed.data.permissionKeys))
   return Response.json({error:"Invalid or protected role/permission selection"},{status:400});
  const {roleKey,permissionKeys}=parsed.data;
  const outcome=await prisma.$transaction(async tx=>{
   if(!await tx.userRole.findFirst({where:{userId:actor,role:{key:"super-admin"}},select:{userId:true}}))return "FORBIDDEN";
   const role=await tx.role.findUnique({where:{key:roleKey},select:{id:true}});
   if(create&&role)return "EXISTS";
   if(!create&&!role)return "NOT_FOUND";
   const all=await tx.permission.findMany({where:{key:{in:permissionKeys}},select:{id:true,key:true}});
   if(all.length!==permissionKeys.length)return "UNKNOWN_PERMISSION";
   const current=role??await tx.role.create({data:{key:roleKey},select:{id:true}});
   // Atomic replacement: removing a grant takes effect immediately for all members.
   await tx.rolePermission.deleteMany({where:{roleId:current.id}});
   if(all.length)await tx.rolePermission.createMany({data:all.map(p=>({roleId:current.id,permissionId:p.id}))});
   if(!create)await tx.user.updateMany({where:{roles:{some:{roleId:current.id}}},data:{sessionVersion:{increment:1}}});
   await tx.staffAudit.create({data:{actorId:actor,action:create?"role.created":"role.permissions.updated",resource:"roles",targetId:current.id}});
   return "OK";
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(outcome==="FORBIDDEN")return Response.json({error:"Super Admin required"},{status:403});
  if(outcome==="EXISTS")return Response.json({error:"Role already exists"},{status:409});
  if(outcome==="NOT_FOUND")return Response.json({error:"Unknown role"},{status:404});
  if(outcome==="UNKNOWN_PERMISSION")return Response.json({error:"Permission missing from catalog"},{status:409});
  return Response.json({roleKey,permissionKeys,status:create?"CREATED":"UPDATED"},{status:create?201:200,headers:{"Cache-Control":"no-store"}});
 }catch(error){
  if(error&&typeof error==="object"&&"code" in error&&error.code==="P2002")return Response.json({error:"Role already exists"},{status:409});
  if(error&&typeof error==="object"&&"code" in error&&error.code==="P2034")return Response.json({error:"Concurrent role edit; retry"},{status:409});
  return staffWriteError(error);
 }
}
export async function POST(request:NextRequest){return writeRole(request,true)}
export async function PUT(request:NextRequest){return writeRole(request,false)}
