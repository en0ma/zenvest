import {prisma} from "./db";
import {hashBotKey} from "./bot-manager-policy";
/** Future integration routes must independently verify provider trade data.
 * Authentication itself never confers custody or settlement authority. */
export async function authenticateBotKey(header:string|null){
 if(!header?.startsWith("Bearer "))return null;
 const raw=header.slice(7);
 if(!/^zvb_[A-Za-z0-9_-]{43}$/.test(raw))return null;
 const key=await prisma.botApiKey.findUnique({where:{keyHash:hashBotKey(raw)},
  include:{bot:{include:{strategy:true,owner:{select:{isActive:true}}}}}});
 if(!key||key.revokedAt||!key.bot.owner.isActive||
  key.bot.strategy.status==="SHUTTING_DOWN"||key.bot.strategy.status==="SHUTDOWN")return null;
 const membership=await prisma.userRole.findFirst({where:{userId:key.bot.ownerId,role:{key:"bot"}},select:{userId:true}});
 if(!membership)return null;
 return {botId:key.botId,strategyId:key.bot.strategyId,ownerId:key.bot.ownerId,keyId:key.id};
}
