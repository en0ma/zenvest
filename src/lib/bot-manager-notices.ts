import {Resend} from "resend";
import {zenvestSender} from "./email-branding.ts";
import {prisma} from "./db.ts";
/** Email applications are handled outside the app. This worker notifies
 * the account associated with the approved/revoked user handle. */
export async function deliverBotManagerNotices(limit=20){
 const notices=await prisma.botManagerNotice.findMany({
  where:{status:{in:["PENDING","PROCESSING"]},nextAttemptAt:{lte:new Date()}},
  orderBy:{createdAt:"asc"},take:limit,include:{user:{select:{email:true,handle:true}}}
 });
 const results:{id:string;outcome:string}[]=[];
 for(const n of notices){
  const claim=await prisma.botManagerNotice.updateMany({
   where:{id:n.id,status:n.status,nextAttemptAt:{lte:new Date()}},
   data:{status:"PROCESSING",attempts:{increment:1},nextAttemptAt:new Date(Date.now()+300000)}
  });
  if(claim.count!==1)continue;
  try{
   if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)throw Error("EMAIL_NOT_CONFIGURED");
   const url=process.env.NEXTAUTH_URL;
   if(!url||!/^https:\/\//.test(url)&&process.env.NODE_ENV==="production")throw Error("APP_URL_UNCONFIGURED");
   const manager=n.kind==="APPROVED";
   const subject=manager?"Zenvest Bot Manager access approved":"Zenvest Bot Manager access changed";
   const text=manager?(
    "Your Zenvest handle @"+n.user.handle+" has been approved for Bot Manager. "+
    "Sign in to create and manage your strategies: "+(url??"http://localhost:3000")+"/bot-manager"
   ):("Bot Manager access for Zenvest handle @"+n.user.handle+" has been revoked. "+
    "Contact the Zenvest team if this is unexpected.");
   const result=await new Resend(process.env.RESEND_API_KEY).emails.send({
    from:zenvestSender(process.env.EMAIL_FROM),to:n.user.email,subject,text
   });
   if(result.error)throw Error("EMAIL_PROVIDER_REJECTED");
   await prisma.botManagerNotice.updateMany({where:{id:n.id,status:"PROCESSING"},
    data:{status:"SENT",sentAt:new Date()}});
   results.push({id:n.id,outcome:"SENT"});
  }catch{
   await prisma.botManagerNotice.updateMany({where:{id:n.id,status:"PROCESSING"},
    data:{status:"PENDING",nextAttemptAt:new Date(Date.now()+Math.min(3600000,60000*(n.attempts+1)))}
   });
   results.push({id:n.id,outcome:"RETRY_PENDING"});
  }
 }
 return results;
}
