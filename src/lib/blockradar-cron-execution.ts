import {authorizedCron} from "./cron-auth.ts";
import {requestBlockradarWalletAction,type BlockradarCronAction} from "./blockradar-wallet-actions.ts";
export type CronResult={status:number;body:{status?:string;action?:BlockradarCronAction;error?:string}};
export async function executeBlockradarCron(
 request:Request,action:BlockradarCronAction,
 getConfig:()=>{key:string;walletId:string},
 call:typeof requestBlockradarWalletAction=requestBlockradarWalletAction
):Promise<CronResult>{
 if(!authorizedCron(request))return {status:401,body:{error:"Unauthorized"}};
 try{
  await call(action,getConfig());
  return {status:200,body:{status:"requested",action}};
 }catch{
  return {status:503,body:{error:`Blockradar ${action} request failed`}};
 }
}
