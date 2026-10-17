import { NextRequest, NextResponse } from "next/server";
import { activateEmailFromLink } from "@/lib/account-tokens";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const token=request.nextUrl.searchParams.get("token")??"";
 let name:string|null=null;
 try{name=await activateEmailFromLink(token)}catch{console.error("Email activation failed")}
 const url=new URL(name?"/welcome":"/activation-help",request.url);
 const response=NextResponse.redirect(url,303);
 response.headers.set("Cache-Control","no-store");
 if(name) response.cookies.set("zenvest_activation_name",name,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/welcome",maxAge:300});
 return response;
}
