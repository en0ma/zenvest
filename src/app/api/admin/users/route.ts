import {requireStaffPermission} from "@/lib/staff-access";
import {prisma} from "@/lib/db";
export async function GET(){
 try{
 await requireStaffPermission("users:read");
 const users=await prisma.user.findMany({take:25,orderBy:{createdAt:"desc"},select:{id:true,handle:true,email:true,isActive:true}});
 return Response.json({users},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Forbidden"},{status:403})}
}
