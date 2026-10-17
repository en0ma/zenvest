import { NextResponse } from "next/server";
import { z } from "zod";
import { activateEmailFromLink } from "@/lib/account-tokens";
export const runtime="nodejs";
const schema=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export async function POST(request:Request){
 let input:unknown;try{input=await request.json()}catch{return NextResponse.json({error:"Invalid link"},{status:400})}
 const parsed=schema.safeParse(input);if(!parsed.success)return NextResponse.json({error:"Invalid link"},{status:400});
 try{
  const name=await activateEmailFromLink(parsed.data.token);
  if(!name)return NextResponse.json({error:"Expired or already used"},{status:400});
  const response=NextResponse.json({ok:true});
  response.headers.set("Cache-Control","no-store");
  response.cookies.set("zenvest_activation_name",name,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/welcome",maxAge:300});
  return response;
 }catch{console.error("Activation processing failed");return NextResponse.json({error:"Could not verify email"},{status:503})}
}
