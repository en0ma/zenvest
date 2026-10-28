import {createCipheriv,createDecipheriv,createHmac,randomInt,randomBytes,timingSafeEqual} from "node:crypto";
import {prisma} from "@/lib/db";
import {Resend} from "resend";
import {zenvestSender} from "@/lib/email-branding";

const key=()=>{const k=process.env.TWO_FACTOR_ENCRYPTION_KEY;if(!k||!/^[a-f0-9]{64}$/i.test(k))throw Error("TWO_FACTOR_ENCRYPTION_KEY must be 32 bytes in hex");return Buffer.from(k,"hex")};
export function encryptSecret(secret:string){const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",key(),iv);const body=Buffer.concat([cipher.update(secret,"utf8"),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString("base64")}
export function decryptSecret(value:string){const b=Buffer.from(value,"base64");const decipher=createDecipheriv("aes-256-gcm",key(),b.subarray(0,12));decipher.setAuthTag(b.subarray(12,28));return Buffer.concat([decipher.update(b.subarray(28)),decipher.final()]).toString("utf8")}
const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function newTotpSecret(){const b=randomBytes(20);let bits=0,value=0,out="";for(const byte of b){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5}}return out}
function decode32(s:string){let bits=0,value=0;const bytes:number[]=[];for(const c of s.toUpperCase().replace(/=+$/,"")){const d=alphabet.indexOf(c);if(d<0)throw Error("Invalid secret");value=(value<<5)|d;bits+=5;if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8}}return Buffer.from(bytes)}
export function totpAt(secret:string,step:number){const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(step));const h=createHmac("sha1",decode32(secret)).update(b).digest();const i=h[h.length-1]&15;return String((h.readUInt32BE(i)&0x7fffffff)%1000000).padStart(6,"0")}
export function validTotpStep(secret:string,code:string,lastStep=-1n){if(!/^\d{6}$/.test(code))return null;const now=Math.floor(Date.now()/30000);for(const t of [now-1,now,now+1])if(BigInt(t)>lastStep&&timingSafeEqual(Buffer.from(totpAt(secret,t)),Buffer.from(code)))return BigInt(t);return null}
export const hashCode=(challengeId:string,code:string)=>createHmac("sha256",key()).update(challengeId+":"+code).digest("hex");
export async function sendSecurityCode(to:string,code:string){const apiKey=process.env.RESEND_API_KEY,sender=process.env.EMAIL_FROM;if(!apiKey||!sender)throw Error("Email not configured");const r=await new Resend(apiKey).emails.send({from:zenvestSender(sender),to,subject:"Your Zenvest verification code",text:`Your Zenvest verification code is ${code}. It expires in 5 minutes. If you did not request this code, you can ignore this email.`});if(r.error)throw Error("Email delivery failed")}
export async function makeChallenge(userId:string,method:"EMAIL"|"APP",purpose:"LOGIN"|"ENABLE"|"DISABLE"){const code=method==="EMAIL"?String(randomInt(0,1000000)).padStart(6,"0"):null;const ch=await prisma.twoFactorChallenge.create({data:{userId,method,purpose,expiresAt:new Date(Date.now()+5*60000)}});if(code){await prisma.twoFactorChallenge.update({where:{id:ch.id},data:{codeHash:hashCode(ch.id,code)}})}return {id:ch.id,code}}
export async function verifyChallenge(id:string,userId:string,purpose:string,code:string){
 const audit=(outcome:string,method:string="unknown")=>console.info(JSON.stringify({component:"auth-2fa",event:"challenge_verification",purpose,method,outcome}));
 if(!/^\\d{6}$/.test(code)){audit("invalid_format");return false}
 try {
  const result=await prisma.$transaction(async tx=>{
   const c=await tx.twoFactorChallenge.findUnique({where:{id}});
   if(!c||c.userId!==userId||c.purpose!==purpose){return {valid:false,reason:"invalid_challenge",method:"unknown"}}
   if(c.consumedAt)return {valid:false,reason:"already_consumed",method:c.method};
   if(c.expiresAt<=new Date())return {valid:false,reason:"expired",method:c.method};
   if(c.attempts>=5)return {valid:false,reason:"attempt_limit",method:c.method};
   await tx.twoFactorChallenge.update({where:{id},data:{attempts:{increment:1}}});
   let valid=false;
   if(c.method==="EMAIL"){
    const expected=c.codeHash??"";
    const computed=hashCode(id,code);
    valid=expected.length===computed.length&&timingSafeEqual(Buffer.from(expected),Buffer.from(computed));
   }else{
    const f=await tx.twoFactor.findUnique({where:{userId}});
    if(!f?.secretEncrypted)return {valid:false,reason:"missing_totp_secret",method:c.method};
    const step=validTotpStep(decryptSecret(f.secretEncrypted),code,f.lastTotpStep);
    valid=step!==null;
    if(valid&&step!==null){
     const gate=await tx.twoFactor.updateMany({where:{userId,lastTotpStep:{lt:step}},data:{lastTotpStep:step}});
     valid=gate.count===1;
     if(!valid)return {valid:false,reason:"replayed_step",method:c.method};
    }
   }
   if(!valid)return {valid:false,reason:"code_rejected",method:c.method};
   const claimed=await tx.twoFactorChallenge.updateMany({where:{id,consumedAt:null},data:{consumedAt:new Date()}});
   return {valid:claimed.count===1,reason:claimed.count===1?"accepted":"already_consumed",method:c.method};
  },{isolationLevel:"Serializable"});
  audit(result.reason,result.method);
  return result.valid;
 }catch(error){
  // Never record passwords, verification codes, setup secrets, recovery codes or database identifiers.
  console.error(JSON.stringify({component:"auth-2fa",event:"challenge_verification",purpose,outcome:"internal_error",errorType:error instanceof Error?error.name:"UnknownError"}));
  throw error;
 }
}
export const recoveryHash=(code:string)=>createHmac("sha256",key()).update("recovery:"+code.replace(/-/g,"").toUpperCase()).digest("hex");
export async function createRecoveryCodes(userId:string){const codes=Array.from({length:8},()=>randomBytes(6).toString("hex").toUpperCase());await prisma.twoFactorRecoveryCode.createMany({data:codes.map(code=>({userId,hash:recoveryHash(code)}))});return codes.map(code=>code.slice(0,6)+"-"+code.slice(6))}
export async function consumeRecoveryCode(userId:string,code:string){if(!/^[A-Fa-f0-9]{6}-?[A-Fa-f0-9]{6}$/.test(code))return false;const r=await prisma.twoFactorRecoveryCode.updateMany({where:{userId,hash:recoveryHash(code),usedAt:null},data:{usedAt:new Date()}});return r.count===1}
export const IDLE_MS=30*60*1000;
