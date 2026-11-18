import {getServerSession} from "next-auth";
import {authOptions} from "./auth";
import {prisma} from "./db";
/** Role checks are live, not trusted from the JWT or UI. */
export async function currentBotManager():Promise<string|null>{
 const session=await getServerSession(authOptions);
 const id=session?.user?.id;
 if(!id)return null;
 const member=await prisma.userRole.findFirst({where:{userId:id,role:{key:"bot"}},select:{userId:true}});
 return member?id:null;
}
