import type {NextRequest} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {staffWriteError} from "@/lib/staff-write-error";
import {requireStaffPermission} from "@/lib/staff-access";
export const dynamic="force-dynamic";
const input=z.object({userId:z.string().min(1).max(100),roleKey:z.enum(["operations","finance","support","auditor"])}).strict();
export async function POST(request:NextRequest){
 try{
  const actor=await requireStaffPermission("roles:manage",{requireFreshLogin:true});
  const parsed=input.safeParse(await request.json());
  if(!parsed.success)return Response.json({error:"Invalid revocation request"},{status:400});
  const {userId,roleKey}=parsed.data;
  if(userId===actor)return Response.json({error:"Self-revocation requires independent authorization"},{status:403});
  const outcome=await prisma.$transaction(async tx=>{
   const role=await tx.staffRole.findUnique({where:{key:roleKey},select:{id:true}});
   if(!role)return "NOT_FOUND";
   const removed=await tx.staffRoleMembership.deleteMany({where:{userId,roleId:role.id}});
   if(removed.count===0)return "NOT_FOUND";
   await tx.user.update({where:{id:userId},data:{sessionVersion:{increment:1}}});
   await tx.staffAudit.create({data:{actorId:actor,action:"role.revoked:"+roleKey,resource:"roles",targetId:userId}});
   return "REVOKED";
  });
  if(outcome==="NOT_FOUND")return Response.json({error:"Role membership not found"},{status:404});
  return Response.json({status:"REVOKED"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return staffWriteError(error)}
}
