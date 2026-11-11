import {prisma} from "./db";
import {hashBotKey} from "./bot-manager-policy";
/** Manager-scoped credentials: route-level operations MUST also check
 * ownership of the requested strategy. Never grants financial authority. */
export async function authenticateBotKey(header:string|null){
 if(!header?.startsWith("Bearer "))return null;
 const raw=header.slice(7);
 if(!/^zvb_[A-Za-z0-9_-]{43}$/.test(raw))return null;
 const key=await prisma.botApiKey.findUnique({where:{keyHash:hashBotKey(raw)},
  include:{owner:{select:{isActive:true,emailVerifiedAt:true}}}});
 if(!key||key.revokedAt||!key.owner.isActive||!key.owner.emailVerifiedAt)return null;
 const [membership,factor]=await Promise.all([
  prisma.userRole.findFirst({where:{userId:key.ownerId,role:{key:"bot"}},select:{userId:true}}),
  prisma.twoFactor.findUnique({where:{userId:key.ownerId},select:{verifiedAt:true}})
 ]);
 if(!membership||!factor?.verifiedAt)return null;
 return {ownerId:key.ownerId,keyId:key.id};
}
