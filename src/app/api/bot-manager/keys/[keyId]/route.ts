import {prisma} from "@/lib/db";
import {currentBotManager} from "@/lib/bot-manager-access";
export const dynamic="force-dynamic";
type Context={params:Promise<{keyId:string}>};
export async function DELETE(_request:Request,{params}:Context){
 const ownerId=await currentBotManager();
 if(!ownerId)return Response.json({error:"Bot role required"},{status:403});
 const {keyId}=await params;
 const changed=await prisma.botApiKey.updateMany({
  where:{id:keyId,ownerId,revokedAt:null},data:{revokedAt:new Date()}
 });
 return Response.json({revoked:changed.count===1},{headers:{"Cache-Control":"no-store"}});
}
