"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
function VerifyEmailContent(){
 const router=useRouter();const params=useSearchParams();const token=params.get("token")??"";
 useEffect(()=>{
  let canceled=false;
  async function verify(){
   if(!/^[a-f0-9]{64}$/.test(token)){router.replace("/activation-help");return}
   try{
    const res=await fetch("/api/account/activate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token}),cache:"no-store"});
    if(!canceled)router.replace(res.ok?"/welcome":"/activation-help");
   }catch{if(!canceled)router.replace("/activation-help")}
  }
  void verify();return()=>{canceled=true};
 },[token,router]);
 return <main className="min-h-screen zen-auth-gradient grid place-items-center p-6"><section role="status" className="w-full max-w-md bg-white rounded-3xl border border-[#DFE5EF] p-10 text-center"><Link href="/" className="text-3xl font-black text-[#243553]">zenvest<span className="text-[#7778D6]">.</span></Link><div className="mx-auto mt-9 h-9 w-9 rounded-full border-4 border-[#eddccc] border-t-[#91603f] animate-spin"/><h1 className="mt-7 text-2xl font-semibold">Verifying your email…</h1><p className="mt-3 text-[#586B84]">This happens automatically. You'll be redirected shortly.</p></section></main>
}

export default function VerifyEmail(){return <Suspense fallback={<main className="min-h-screen grid place-items-center zen-auth-gradient">Verifying your email…</main>}><VerifyEmailContent/></Suspense>}
