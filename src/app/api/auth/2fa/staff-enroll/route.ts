import {NextResponse} from "next/server";
import {randomBytes} from "node:crypto";
import bcrypt from "bcryptjs";
import {prisma} from "@/lib/db";
import {makeChallenge,newTotpSecret,encryptSecret,decryptSecret,validTotpStep,verifyChallenge,sendSecurityCode,recoveryHash} from "@/lib/two-factor";
export const runtime="nodejs";

/** Pre-session enrollment only. Every request rechecks password + live staff role. */
export async function POST(req:Request){
 let body:unknown;
 try{body=await req.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
 const v=body as {action?:unknown;email?:unknown;password?:unknown;method?:unknown;challengeId?:unknown;code?:unknown};
 if(!v||typeof v.email!=="string"||typeof v.password!=="string"||v.email.length>254||v.password.length>72||!v.password)
  return NextResponse.json({error:"Invalid credentials"},{status:400});
 const user=await prisma.user.findUnique({where:{email:v.email.trim().toLowerCase()},select:{id:true,email:true,passwordHash:true,isActive:true,emailVerifiedAt:true}});
 if(!user?.isActive||!user.emailVerifiedAt||!await bcrypt.compare(v.password,user.passwordHash))return NextResponse.json({error:"Incorrect email or password"},{status:401});
 const roles=await prisma.userRole.count({where:{userId:user.id,role:{key:{not:"user"}}}});
 if(!roles)return NextResponse.json({error:"Enrollment is not required for this account"},{status:403});
 if(await prisma.twoFactor.findUnique({where:{userId:user.id},select:{userId:true}}))return NextResponse.json({error:"Two-step verification is already enabled"},{status:409});
 if(v.action==="setup"&&(v.method==="APP"||v.method==="EMAIL")){
  const count=await prisma.twoFactorChallenge.count({where:{userId:user.id,purpose:"ENABLE",createdAt:{gt:new Date(Date.now()-60000)}}});
  if(count>=3)return NextResponse.json({error:"Try again in a minute"},{status:429});
  const c=await makeChallenge(user.id,v.method,"ENABLE");
  if(v.method==="EMAIL"){
   try{await sendSecurityCode(user.email,c.code!)}catch{return NextResponse.json({error:"Could not send verification email"},{status:503})}
   return NextResponse.json({challengeId:c.id,method:"EMAIL"});
  }
  const secret=newTotpSecret();
  await prisma.twoFactorChallenge.update({where:{id:c.id},data:{codeHash:encryptSecret(secret)}});
  return NextResponse.json({challengeId:c.id,method:"APP",secret,uri:`otpauth://totp/Zenvest:${encodeURIComponent(user.email)}?secret=${secret}&issuer=Zenvest&algorithm=SHA1&digits=6&period=30`});
 }
 if(v.action==="confirm"&&typeof v.challengeId==="string"&&typeof v.code==="string"&&/^\d{6}$/.test(v.code)){
  const c=await prisma.twoFactorChallenge.findUnique({where:{id:v.challengeId}});
  if(!c||c.userId!==user.id||c.purpose!=="ENABLE"||c.consumedAt||c.expiresAt<=new Date()||c.attempts>=5)return NextResponse.json({error:"Setup expired; start again"},{status:400});
  let secret:string|null=null,step:bigint|null=null;
  if(c.method==="APP"){
   if(!c.codeHash)return NextResponse.json({error:"Setup expired"},{status:400});
   secret=decryptSecret(c.codeHash);
   step=validTotpStep(secret,v.code);
   if(step===null){await prisma.twoFactorChallenge.updateMany({where:{id:c.id,consumedAt:null,attempts:{lt:5}},data:{attempts:{increment:1}}});return NextResponse.json({error:"Incorrect code"},{status:400})}
  }else if(c.method==="EMAIL"){
   if(!await verifyChallenge(c.id,user.id,"ENABLE",v.code))return NextResponse.json({error:"Incorrect code"},{status:400});
  }else return NextResponse.json({error:"Invalid verification method"},{status:400});
  const codes=Array.from({length:8},()=>randomBytes(6).toString("hex").toUpperCase());
  try{
   await prisma.$transaction(async tx=>{
    if(!await tx.userRole.count({where:{userId:user.id,role:{key:{not:"user"}}}}))throw Error("Staff role removed");
    if(await tx.twoFactor.findUnique({where:{userId:user.id},select:{userId:true}}))throw Error("Already enabled");
    if(c.method==="APP"){
     const claim=await tx.twoFactorChallenge.updateMany({where:{id:c.id,consumedAt:null,expiresAt:{gt:new Date()},attempts:{lt:5}},data:{consumedAt:new Date(),attempts:{increment:1}}});
     if(claim.count!==1)throw Error("Setup already used");
    }
    await tx.twoFactor.create({data:{userId:user.id,method:c.method,emailEnabled:c.method==="EMAIL",secretEncrypted:secret?encryptSecret(secret):null,lastTotpStep:step??-1n}});
    await tx.twoFactorRecoveryCode.createMany({data:codes.map(code=>({userId:user.id,hash:recoveryHash(code)}))});
    await tx.user.update({where:{id:user.id},data:{sessionVersion:{increment:1}}});
   });
  }catch{return NextResponse.json({error:"Could not complete enrollment; restart setup"},{status:409})}
  return NextResponse.json({ok:true,recoveryCodes:codes.map(code=>code.slice(0,6)+"-"+code.slice(6))});
 }
 return NextResponse.json({error:"Invalid action"},{status:400});
}
