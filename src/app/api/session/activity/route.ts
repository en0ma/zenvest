import {getToken} from "next-auth/jwt";
import {prisma} from "@/lib/db";
import {IDLE_MS} from "@/lib/two-factor";
import {NextResponse} from "next/server";
export const runtime="nodejs";
export async function POST(req:Request){
 const token=await getToken({req:req as never,secret:process.env.NEXTAUTH_SECRET});
 if(!token?.sub||typeof token.sid!=="string")return NextResponse.json({error:"Not authenticated"},{status:401});
 const now=new Date();
 const updated=await prisma.securitySession.updateMany({where:{id:token.sid,userId:token.sub,lastActivityAt:{gt:new Date(now.getTime()-IDLE_MS)},createdAt:{gt:new Date(now.getTime()-12*60*60*1000)}},data:{lastActivityAt:now}});
 return updated.count===1?NextResponse.json({ok:true}):NextResponse.json({error:"Session expired"},{status:401});
}
