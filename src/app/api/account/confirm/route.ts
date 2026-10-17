import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {passwordSchema} from "@/lib/validation";
import { consumeToken } from "@/lib/account-tokens";
export const runtime="nodejs";
const schema=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),purpose:z.enum(["VERIFY_EMAIL","RESET_PASSWORD"]),password:passwordSchema.optional()}).strict();
export async function POST(request:Request){
 let data:unknown;try{data=await request.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
 const parsed=schema.safeParse(data);if(!parsed.success)return NextResponse.json({error:"Invalid or expired link"},{status:400});
 const {token,purpose,password}=parsed.data;
 if(purpose==="RESET_PASSWORD"&&!password)return NextResponse.json({error:"Password required"},{status:400});
 if(purpose==="VERIFY_EMAIL"&&password)return NextResponse.json({error:"Invalid request"},{status:400});
 try {
  const hash=password?await bcrypt.hash(password,12):undefined;
  const ok=await consumeToken(token,purpose,hash);
  return ok?NextResponse.json({ok:true}):NextResponse.json({error:"Invalid or expired link"},{status:400});
 }catch{return NextResponse.json({error:"Could not complete request"},{status:503})}
}
