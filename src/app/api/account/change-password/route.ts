import {NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import bcrypt from "bcryptjs";
import {authOptions} from "@/lib/auth";
import {prisma} from "@/lib/db";
import {isValidPassword} from "@/lib/password-policy";
export const runtime="nodejs";
export async function POST(req:Request){
 const session=await getServerSession(authOptions);
 if(!session?.user?.id)return NextResponse.json({error:"Not signed in"},{status:401});
 let input:{currentPassword?:unknown;newPassword?:unknown};
 try{input=await req.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
 if(typeof input?.currentPassword!=="string"||typeof input?.newPassword!=="string"||input.currentPassword.length>72||!isValidPassword(input.newPassword))return NextResponse.json({error:"Check the password requirements."},{status:400});
 const user=await prisma.user.findUnique({where:{id:session.user.id},select:{id:true,passwordHash:true}});
 if(!user)return NextResponse.json({error:"Account unavailable"},{status:404});
 if(!await bcrypt.compare(input.currentPassword,user.passwordHash))return NextResponse.json({error:"Current password is incorrect"},{status:403});
 if(await bcrypt.compare(input.newPassword,user.passwordHash))return NextResponse.json({error:"Choose a different password"},{status:400});
 const passwordHash=await bcrypt.hash(input.newPassword,12);
 await prisma.user.update({where:{id:user.id},data:{passwordHash,sessionVersion:{increment:1}}});
 return NextResponse.json({ok:true,loginRequired:true});
}
