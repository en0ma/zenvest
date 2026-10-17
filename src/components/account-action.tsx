"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from "lucide-react";
export function RequestLink({purpose}:{purpose:"VERIFY_EMAIL"|"RESET_PASSWORD"}){
 const [notice,setNotice]=useState("");const [error,setError]=useState("");const [pending,setPending]=useState(false);
 const activation=purpose==="VERIFY_EMAIL";
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setPending(true);setNotice("");setError("");
  const email=new FormData(e.currentTarget).get("email");
  try {
   const res=await fetch("/api/account/request-link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,purpose})});
   if(!res.ok){setError("We couldn't submit your request. Please check the address and try again.");return;}
   setNotice(activation?"If this address belongs to an account awaiting verification, you'll receive an activation email. Check your inbox and spam folder.":"Check your inbox for the next steps. If your email isn't verified yet, we'll send an activation link first. You can also request a fresh activation link below.");
  }catch{setError("Connection issue. Please try again.");}finally{setPending(false);}
 }
 return <main className="min-h-screen bg-[#faf8f3] flex flex-col items-center justify-center p-5 sm:p-8">
 <div className="w-full max-w-[460px]"><Link href="/" className="text-3xl font-black tracking-tight text-[#292725]">zenvest<span className="text-[#b77d52]">.</span></Link>
 <section className="mt-9 rounded-2xl border border-[#e8dfd3] bg-white p-7 sm:p-10 shadow-[0_20px_80px_-45px_#5b4a3a]"><div className="w-12 h-12 rounded-xl bg-[#f5e7d6] text-[#91603f] flex items-center justify-center"><Mail size={22}/></div>
 <p className="mt-8 text-xs uppercase tracking-[.16em] font-bold text-[#9d7658]">Account recovery</p><h1 className="mt-3 text-3xl sm:text-4xl tracking-tight font-semibold text-[#292725]">{activation?"Activate your account":"Reset your password"}</h1>
 <p className="mt-4 text-[#72685e] leading-7">{activation?"Enter your email and we'll help you complete verification.":"Enter your email to get back into your account. If your account isn't activated, we'll help with verification first."}</p>
 <form className="mt-8 space-y-5" onSubmit={submit}><label className="text-sm font-semibold text-[#302d29] block">Email address<input required type="email" name="email" autoComplete="email" placeholder="you@example.com" className="w-full mt-2 rounded-xl border border-[#dccfc0] bg-[#fffdfb] p-3.5 outline-none focus:border-[#b77d52] focus:ring-4 focus:ring-[#f0e2d2]"/></label>
 <button disabled={pending} className="w-full py-3.5 rounded-xl bg-[#292725] text-white font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2">{pending?"Sending request…":activation?"Send activation link":"Continue"}<ArrowRight size={17}/></button></form>
 {notice&&<div role="status" className="mt-6 rounded-xl border border-[#dfccb5] bg-[#faf4eb] p-5 text-sm text-[#493a2c]"><div className="flex items-center gap-2 font-bold"><ShieldCheck size={18}/> Request received</div><p className="mt-2 leading-6">{notice}</p></div>}
 {error&&<p role="alert" className="mt-5 rounded-xl bg-[#fff2ee] border border-[#e8c6b9] p-4 text-sm text-[#853c36]">{error}</p>}
 <div className="mt-7 border-t border-[#eee7df] pt-6 space-y-3 text-sm">{!activation&&<Link href="/resend-activation" className="block font-semibold text-[#94613d] hover:underline">Email not activated? Resend activation link →</Link>}{activation&&<Link href="/forgot-password" className="block font-semibold text-[#94613d] hover:underline">Already activated? Reset password →</Link>}<Link className="inline-flex items-center gap-2 text-[#60574f] hover:underline" href="/login"><ArrowLeft size={16}/> Back to login</Link></div>
 </section></div></main>;
}
export function ConfirmLink({purpose,token}:{purpose:"VERIFY_EMAIL"|"RESET_PASSWORD";token:string}){
 const [notice,setNotice]=useState("");const [pending,setPending]=useState(false);const [ok,setOk]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setPending(true);
 const password=purpose==="RESET_PASSWORD"?new FormData(e.currentTarget).get("password"):undefined;
 try{const res=await fetch("/api/account/confirm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,purpose,...(password?{password}:{})})});const data=await res.json();setOk(res.ok);setNotice(res.ok?"Success. You can sign in now.":data.error??"Invalid or expired link.");}
 catch{setNotice("Could not complete request.")}finally{setPending(false)}}
 return <main className="min-h-screen flex items-center justify-center bg-canvas p-6"><section className="max-w-md w-full bg-white p-9 rounded-2xl shadow-soft"><Link href="/" className="text-3xl font-bold text-forest">zenvest.</Link><h1 className="text-2xl mt-7 font-semibold">{purpose==="VERIFY_EMAIL"?"Activate your account":"Set a new password"}</h1>{!ok&&<form className="mt-6 space-y-4" onSubmit={submit}>{purpose==="RESET_PASSWORD"&&<label className="text-sm block">New password (5–15 characters, uppercase, number and symbol)<input required type="password" name="password" minLength={5} maxLength={15} autoComplete="new-password" className="w-full mt-2 border rounded-lg p-3"/></label>}<button disabled={pending||!token} className="w-full p-3 rounded-lg bg-forest text-white disabled:opacity-50">{purpose==="VERIFY_EMAIL"?"Activate email":"Reset password"}</button></form>}{notice&&<p role="status" className="mt-4 text-sm">{notice}</p>}<Link href="/login" className="mt-5 block text-sm text-forest underline">Back to login</Link></section></main>;
}
