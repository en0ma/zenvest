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
 return <main className="min-h-screen bg-[#faf8f3] grid place-items-center p-6"><section role="status" className="w-full max-w-md bg-white rounded-3xl border border-[#e8ddce] p-10 text-center"><Link href="/" className="text-3xl font-black text-[#292725]">zenvest<span className="text-[#b77d52]">.</span></Link><div className="mx-auto mt-9 h-9 w-9 rounded-full border-4 border-[#eddccc] border-t-[#91603f] animate-spin"/><h1 className="mt-7 text-2xl font-semibold">Verifying your email…</h1><p className="mt-3 text-[#695e53]">This happens automatically. You'll be redirected shortly.</p></section></main>
}

export default function VerifyEmail(){return <Suspense fallback={<main className="min-h-screen grid place-items-center bg-[#faf8f3]">Verifying your email…</main>}><VerifyEmailContent/></Suspense>}
