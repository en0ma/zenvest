import {NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth";
import {prisma} from "@/lib/db";
import {makeChallenge,newTotpSecret,encryptSecret,decryptSecret,validTotpStep,sendSecurityCode,verifyChallenge,recoveryHash,consumeRecoveryCode} from "@/lib/two-factor";
import {randomBytes} from "node:crypto";
import bcrypt from "bcryptjs";
export const runtime="nodejs";
async function account(){const s=await getServerSession(authOptions);return s?.user?.id?prisma.user.findUnique({where:{id:s.user.id}}):null}
export async function GET(){const u=await account();if(!u)return NextResponse.json({error:"Not signed in"},{status:401});const f=await prisma.twoFactor.findUnique({where:{userId:u.id}});return NextResponse.json({enabled:!!f,method:f?.method??null})}
export async function POST(req:Request){
 const u=await account();if(!u)return NextResponse.json({error:"Not signed in"},{status:401});
 let v:{action?:string;password?:string;method?:string;challengeId?:string;code?:string};try{v=await req.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
 if(!v||typeof v.password!=="string"||!await bcrypt.compare(v.password,u.passwordHash))return NextResponse.json({error:"Password incorrect"},{status:403});
 const f=await prisma.twoFactor.findUnique({where:{userId:u.id}});
 if(v.action==="setup"&&!f&&(v.method==="APP"||v.method==="EMAIL")){
  const recent=await prisma.twoFactorChallenge.count({where:{userId:u.id,purpose:"ENABLE",createdAt:{gt:new Date(Date.now()-60000)}}});
  if(recent>=3)return NextResponse.json({error:"Try again in a minute"},{status:429});
  const c=await makeChallenge(u.id,v.method,"ENABLE");
  if(v.method==="EMAIL"){try{await sendSecurityCode(u.email,c.code!)}catch{return NextResponse.json({error:"Could not send verification email"},{status:503})}return NextResponse.json({challengeId:c.id,method:"EMAIL"})}
  const secret=newTotpSecret();await prisma.twoFactorChallenge.update({where:{id:c.id},data:{codeHash:encryptSecret(secret)}});
  return NextResponse.json({challengeId:c.id,method:"APP",secret,uri:`otpauth://totp/Zenvest:${encodeURIComponent(u.email)}?secret=${secret}&issuer=Zenvest&algorithm=SHA1&digits=6&period=30`});
 }
 if(v.action==="enable"&&!f&&typeof v.challengeId==="string"&&typeof v.code==="string"){
  const c=await prisma.twoFactorChallenge.findUnique({where:{id:v.challengeId}});
  if(!c||c.userId!==u.id||c.purpose!=="ENABLE"||c.consumedAt||c.expiresAt<=new Date()||c.attempts>=5)return NextResponse.json({error:"Code expired; start again"},{status:400});
  let appSecret:string|null=null,step:bigint|null=null;
  if(c.method==="EMAIL"){
   if(!await verifyChallenge(c.id,u.id,"ENABLE",v.code))return NextResponse.json({error:"Incorrect code"},{status:400});
  }else if(c.method==="APP"){
   if(!c.codeHash)return NextResponse.json({error:"Setup expired"},{status:400});
   appSecret=decryptSecret(c.codeHash);step=validTotpStep(appSecret,v.code);
   if(step===null){
    await prisma.twoFactorChallenge.updateMany({where:{id:c.id,consumedAt:null,attempts:{lt:5}},data:{attempts:{increment:1}}});
    return NextResponse.json({error:"Incorrect code"},{status:400});
   }
  }else return NextResponse.json({error:"Invalid verification method"},{status:400});
  const recoveryCodes=Array.from({length:8},()=>randomBytes(6).toString("hex").toUpperCase());
  await prisma.$transaction(async tx=>{
   if(c.method==="APP"){
    const claim=await tx.twoFactorChallenge.updateMany({where:{id:c.id,consumedAt:null,expiresAt:{gt:new Date()},attempts:{lt:5}},data:{consumedAt:new Date(),attempts:{increment:1}}});
    if(claim.count!==1)throw Error("Setup already used or expired");
   }
   await tx.twoFactor.create({data:{userId:u.id,method:c.method,secretEncrypted:appSecret?encryptSecret(appSecret):null,lastTotpStep:step??-1n}});
   await tx.twoFactorRecoveryCode.createMany({data:recoveryCodes.map(code=>({userId:u.id,hash:recoveryHash(code)}))});
   await tx.user.update({where:{id:u.id},data:{sessionVersion:{increment:1}}});
  });
  return NextResponse.json({ok:true,loginRequired:true,recoveryCodes:recoveryCodes.map(code=>code.slice(0,6)+"-"+code.slice(6))});
 }
 if(v.action==="disable"&&f&&typeof v.code==="string"){
  const code=v.code;
  let valid=false;
  if(/^[A-Fa-f0-9]{6}-?[A-Fa-f0-9]{6}$/.test(code))valid=await consumeRecoveryCode(u.id,code);
  if(!valid&&f.method==="APP"&&f.secretEncrypted)valid=validTotpStep(decryptSecret(f.secretEncrypted),code,f.lastTotpStep)!==null;
  if(!valid&&f.method==="EMAIL"&&typeof v.challengeId==="string")valid=await verifyChallenge(v.challengeId,u.id,"DISABLE",code);
  if(!valid)return NextResponse.json({error:"Incorrect code"},{status:403});
  await prisma.$transaction([prisma.twoFactor.delete({where:{userId:u.id}}),prisma.user.update({where:{id:u.id},data:{sessionVersion:{increment:1}}})]);
  return NextResponse.json({ok:true,loginRequired:true});
 }
 if(v.action==="disable-code"&&f?.method==="EMAIL"){
  const c=await makeChallenge(u.id,"EMAIL","DISABLE");try{await sendSecurityCode(u.email,c.code!)}catch{return NextResponse.json({error:"Could not send email"},{status:503})}return NextResponse.json({challengeId:c.id});
 }
 return NextResponse.json({error:"Invalid action"},{status:400});
}