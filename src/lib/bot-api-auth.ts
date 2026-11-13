import {prisma} from "./db";
import {hashBotKey} from "./bot-manager-policy";
/** The public key ID and the secret are both required. Legacy Bearer is not
 * sufficient to authorize a v1 strategy request. */
export async function authenticateBotKey(request:Request){
 const id=request.headers.get("x-zenvest-api-key");
 const secret=request.headers.get("x-zenvest-api-secret");
 if(!id||id.length>100||!secret||!/^zvb_[A-Za-z0-9_-]{43}$/.test(secret))return null;
 const key=await prisma.botApiKey.findFirst({where:{id,keyHash:hashBotKey(secret),revokedAt:null},
  include:{owner:{select:{isActive:true,emailVerifiedAt:true}}}});
 if(!key||!key.owner.isActive||!key.owner.emailVerifiedAt)return null;
 const [membership,factor]=await Promise.all([
  prisma.userRole.findFirst({where:{userId:key.ownerId,role:{key:"bot"}},select:{userId:true}}),
  prisma.twoFactor.findUnique({where:{userId:key.ownerId},select:{verifiedAt:true}})
 ]);
 if(!membership||!factor?.verifiedAt)return null;
 return {ownerId:key.ownerId,keyId:key.id};
}
