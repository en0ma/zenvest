import {NextResponse} from "next/server";
import {prisma} from "@/lib/db";
import bcrypt from "bcryptjs";
import {makeChallenge,sendSecurityCode} from "@/lib/two-factor";
export const runtime="nodejs";
export async function POST(req:Request){
 let body:unknown;try{body=await req.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
 const v=body as {email?:unknown;password?:unknown;method?:unknown};
 if(typeof v?.email!=="string"||typeof v.password!=="string"||v.email.length>254||v.password.length>72)return NextResponse.json({error:"Invalid credentials"},{status:400});
 const user=await prisma.user.findUnique({where:{email:v.email.trim().toLowerCase()}});
 if(!user?.isActive||!user.emailVerifiedAt||!await bcrypt.compare(v.password,user.passwordHash))return NextResponse.json({error:"Incorrect email or password"},{status:401});
 const t=await prisma.twoFactor.findUnique({where:{userId:user.id}});
 if(!t){console.info(JSON.stringify({component:"auth-2fa",event:"login_challenge",outcome:"not_required"}));return NextResponse.json({requires2fa:false});}
 const recent=await prisma.twoFactorChallenge.count({where:{userId:user.id,purpose:"LOGIN",createdAt:{gt:new Date(Date.now()-60000)}}});
 if(recent>=3){console.info(JSON.stringify({component:"auth-2fa",event:"login_challenge",outcome:"rate_limited",method:t.method}));return NextResponse.json({error:"Please try again in a minute"},{status:429});}
 const method=v.method==="APP"&&!!t.secretEncrypted?"APP":v.method==="EMAIL"&&t.emailEnabled?"EMAIL":t.method;
 const c=await makeChallenge(user.id,method as "EMAIL"|"APP","LOGIN");
 if(c.code){try{await sendSecurityCode(user.email,c.code)}catch{return NextResponse.json({error:"Could not send verification code"},{status:503})}}
 console.info(JSON.stringify({component:"auth-2fa",event:"login_challenge",outcome:"created",method}));
 return NextResponse.json({requires2fa:true,challengeId:c.id,method,methods:[...(t.emailEnabled?["EMAIL"]:[]),...(t.secretEncrypted?["APP"]:[])]});
}