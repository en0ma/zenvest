import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";

// Only requests that have never been sent to Blockradar can be cancelled.
export async function POST(request:Request) {
  const user=await requireUser();
  let body:unknown;
  try {body=await request.json();}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
  const id=body && typeof body==="object" && "id" in body ? (body as {id:unknown}).id : null;
  if(typeof id!=="string" || !/^c[a-z0-9]{10,40}$/.test(id)) return NextResponse.json({error:"Invalid withdrawal ID"},{status:400});
  try {
    const cancelled=await prisma.$transaction(async tx=>{
      const item=await tx.investorWithdrawal.findFirst({where:{id,userId:user.id,status:"PENDING",deallocations:{none:{status:{in:["PROCESSING","COMPLETED"]}}}}});
      if(!item) return false;
      const changed=await tx.investorWithdrawal.updateMany({
        where:{id,userId:user.id,status:"PENDING"},
        data:{status:"FAILED",failureCode:"USER_CANCELLED"},
      });
      if(changed.count!==1) return false;
      const total=item.grossUsdcMicros;
      await tx.withdrawalDeallocation.updateMany({where:{withdrawalId:id,status:"PENDING"},data:{status:"FAILED"}});
      await tx.investorPortfolio.update({
        where:{id:item.portfolioId},
        data:{pendingWithdrawalsUsdcMicros:{decrement:total}},
      });
      return true;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    if(!cancelled) return NextResponse.json({error:"Only unapproved requests can be cancelled"},{status:409});
    console.info(JSON.stringify({component:"withdrawal",outcome:"user_cancelled",userId:user.id,withdrawalId:id}));
    return NextResponse.json({message:"success"});
  }catch(error){
    console.error(JSON.stringify({component:"withdrawal",outcome:"cancel_failed",userId:user.id,withdrawalId:id,errorType:error instanceof Error?error.name:"unknown"}));
    return NextResponse.json({error:"Unable to cancel withdrawal"},{status:503});
  }
}
