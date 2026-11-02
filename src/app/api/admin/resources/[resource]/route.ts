import {NextRequest} from "next/server";
import {prisma} from "@/lib/db";
import {requireStaffPermission} from "@/lib/staff-access";
import type {StaffPermissionKey} from "@/lib/staff-permissions";
export const dynamic="force-dynamic";
const read:Record<string,StaffPermissionKey>={deposits:"deposits:read",withdrawals:"withdrawals:read",balances:"balances:read",wallets:"wallets:read",audit:"audit:read",roles:"roles:read"};
export async function GET(request:NextRequest,{params}:{params:Promise<{resource:string}>}){
 try{
 const {resource}=await params,permission=read[resource];
 if(!permission)return Response.json({error:"Unknown resource"},{status:404});
 await requireStaffPermission(permission);
 const n=Number(request.nextUrl.searchParams.get("page")??0);
 const skip=(Number.isFinite(n)?Math.max(0,Math.min(1000,Math.floor(n))):0)*25;
 const paging={skip,take:25};
 let records:unknown;
 if(resource==="deposits") records=await prisma.blockchainDeposit.findMany({...paging,orderBy:{createdAt:"desc"},select:{id:true,walletId:true,amountUsdcMicros:true,status:true,transactionHash:true,createdAt:true}});
 else if(resource==="withdrawals") records=await prisma.withdrawal.findMany({...paging,orderBy:{createdAt:"desc"},select:{id:true,userId:true,amountUsdcMicros:true,status:true,createdAt:true}});
 else if(resource==="balances") records=await prisma.user.findMany({...paging,orderBy:{createdAt:"desc"},select:{id:true,handle:true,unallocated:true}});
 else if(resource==="wallets") records=await prisma.investorDepositWallet.findMany({...paging,orderBy:{createdAt:"desc"},select:{id:true,userId:true,address:true,status:true,createdAt:true}});
 else if(resource==="audit") records=await prisma.staffAudit.findMany({...paging,orderBy:{createdAt:"desc"}});
 else records=await prisma.staffRole.findMany({...paging,select:{id:true,key:true}});
 return Response.json({records:JSON.parse(JSON.stringify(records,(_k,v)=>typeof v==="bigint"?v.toString():v)),skip},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Access denied"},{status:403})}
}
