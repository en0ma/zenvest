"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { passwordChecks, isValidPassword } from "@/lib/password-policy";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck, Eye, EyeOff, CheckCircle2, Circle, AlertCircle, Loader2 } from "lucide-react";
export function RequestLink({purpose}:{purpose:"VERIFY_EMAIL"|"RESET_PASSWORD"}){
 const [notice,setNotice]=useState("");const [error,setError]=useState("");const [pending,setPending]=useState(false);const [submitted,setSubmitted]=useState(false);
 const activation=purpose==="VERIFY_EMAIL";
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending||submitted)return;setPending(true);setNotice("");setError("");
  const email=new FormData(e.currentTarget).get("email");
  try {
   const res=await fetch("/api/account/request-link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,purpose})});
   if(!res.ok){setError("We couldn't submit your request. Please check the address and try again.");return;}
   setSubmitted(true);setNotice(activation?"If an activation email is needed, a link will be sent to this address.":"If you have an active account, a recovery email will be sent to the email address.");
  }catch{setError("Connection issue. Please try again.");}finally{setPending(false);}
 }
 return <main className="min-h-screen bg-[#F7F8FB] flex flex-col items-center justify-center p-5 sm:p-8">
 <div className="w-full max-w-[480px]"><Link href="/" className="text-3xl font-black tracking-tight text-[#14253D]">zenvest<span className="text-[#635BFF]">.</span></Link>
 <section className="mt-8 rounded-2xl border border-[#E4E9F0] bg-white p-6 sm:p-9 shadow-sm"><div className="w-12 h-12 rounded-xl bg-[#F0EEFF] text-[#635BFF] flex items-center justify-center"><Mail size={22}/></div>
 <p className="mt-8 text-xs uppercase tracking-[.16em] font-bold text-[#635BFF]">Account recovery</p><h1 className="mt-3 text-3xl sm:text-4xl tracking-tight font-semibold text-[#14253D]">{activation?"Activate your account":"Reset your password"}</h1>
 <p className="mt-4 text-[#64748B] leading-7">{activation?"Enter your email and we'll help you complete verification.":"Enter your email address to request a password recovery link."}</p>
 <form className="mt-8 space-y-5" onSubmit={submit}><label className="text-sm font-semibold text-[#14253D] block">Email address<input required type="email" name="email" autoComplete="email" placeholder="you@example.com" className="w-full mt-2 rounded-xl border border-[#DCE3EC] bg-white p-3.5 outline-none focus:border-[#635BFF] focus:ring-4 focus:ring-[#635BFF]/10"/></label>
 <button disabled={pending||submitted} className="w-full py-3.5 rounded-xl bg-[#635BFF] text-white font-bold transition-colors hover:bg-[#544CE4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#635BFF]/20 disabled:opacity-50 inline-flex items-center justify-center gap-2">{pending?"Sending request…":submitted?"Request submitted":activation?"Send activation link":"Continue"}<ArrowRight size={17}/></button></form>
 {notice&&<div role="status" className="mt-6 rounded-xl border border-[#CCE5D8] bg-[#F4FAF7] p-5 text-sm text-[#317054]"><div className="flex items-center gap-2 font-bold"><ShieldCheck size={18}/> Request received</div><p className="mt-2 leading-6">{notice}</p></div>}
 {error&&<p role="alert" className="mt-5 rounded-xl bg-[#FCF6F5] border border-[#E8D1CE] p-4 text-sm text-[#925B55]">{error}</p>}

 <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#5145A8] hover:underline"><ArrowLeft size={16}/>Back to login</Link>
 </section></div></main>;
}
export function ConfirmLink({purpose,token}:{purpose:"VERIFY_EMAIL"|"RESET_PASSWORD";token:string}){
 const reset=purpose==="RESET_PASSWORD";
 const [password,setPassword]=useState("");
 const [confirmation,setConfirmation]=useState("");
 const [showPassword,setShowPassword]=useState(false);
 const [showConfirmation,setShowConfirmation]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [pending,setPending]=useState(false);
 const [ok,setOk]=useState(false);
 const [attempted,setAttempted]=useState(false);
 const requirements=passwordChecks(password);
 const valid=reset?isValidPassword(password)&&password===confirmation&&confirmation.length>0:true;
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setAttempted(true);
  if(pending||!token||!valid)return;
  setPending(true);setError("");setNotice("");
  try{
   const res=await fetch("/api/account/confirm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,purpose,...(reset?{password}:{})})});
   const data=await res.json() as {error?:string};
   if(!res.ok){setError(data.error??"This link may have expired. Request a new recovery link.");return;}
   setOk(true);setNotice(reset?"Your password was updated successfully. You can now sign in.":"Your email is verified. You can now sign in.");
  }catch{setError("We couldn't complete your request. Please try again.");}
  finally{setPending(false);}
 }
 const field="mt-2 w-full rounded-xl border border-[#DCE3EC] bg-white px-4 py-3.5 pr-12 text-sm text-[#14253D] outline-none transition-colors duration-200 placeholder:text-[#98A5B4] focus:border-[#635BFF] focus:ring-4 focus:ring-[#635BFF]/10";
 return <main className="flex min-h-screen items-center justify-center bg-[#F7F8FB] p-5 sm:p-8">
 <section className="w-full max-w-[480px] rounded-2xl border border-[#E4E9F0] bg-white p-6 shadow-sm sm:p-9">
  <Link href="/" className="text-3xl font-black tracking-tight text-[#14253D]">zenvest<span className="text-[#635BFF]">.</span></Link>
  <div className="mt-8 flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0EEFF] text-[#635BFF]"><ShieldCheck size={21}/></div>
  <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#14253D]">{reset?"Set a new password":"Activate your account"}</h1>
  <p className="mt-2 text-sm leading-6 text-[#64748B]">{reset?"Choose a secure password to regain access to your Zenvest account.":"Confirm your email address to activate your Zenvest account."}</p>
  {!ok&&<form noValidate className="mt-6 space-y-5" onSubmit={submit}>
   {reset&&<>
    <div><label htmlFor="new-password" className="block text-sm font-semibold text-[#14253D]">New password</label>
     <div className="relative"><input id="new-password" required type={showPassword?"text":"password"} name="password" value={password} onChange={e=>{setPassword(e.target.value);setError("");}} autoComplete="new-password" aria-describedby="password-requirements" aria-invalid={Boolean(attempted&&!isValidPassword(password))} placeholder="Enter your new password" className={field}/>
      <button type="button" onClick={()=>setShowPassword(x=>!x)} aria-label={showPassword?"Hide new password":"Show new password"} aria-pressed={showPassword} className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 rounded-lg p-2 text-[#64748B] transition-colors hover:bg-[#F5F6FA] hover:text-[#14253D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF]">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button>
     </div>
    </div>
    <div id="password-requirements" className="rounded-xl border border-[#E7EBF2] bg-[#F8FAFD] p-4">
     <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Password requirements</p>
     <ul className="mt-3 grid gap-2 sm:grid-cols-2">{requirements.map(item=><li key={item.label} className={"flex items-center gap-2 text-xs transition-colors duration-200 "+(item.passed?"text-[#317054]":"text-[#64748B]")}>{item.passed?<CheckCircle2 size={15} className="shrink-0"/>:<Circle size={15} className="shrink-0"/>}{item.label}</li>)}</ul>
    </div>
    <div><label htmlFor="confirm-new-password" className="block text-sm font-semibold text-[#14253D]">Confirm new password</label>
     <div className="relative"><input id="confirm-new-password" required type={showConfirmation?"text":"password"} name="confirmation" value={confirmation} onChange={e=>{setConfirmation(e.target.value);setError("");}} autoComplete="new-password" aria-invalid={Boolean(confirmation&&confirmation!==password)} placeholder="Re-enter your new password" className={field}/>
      <button type="button" onClick={()=>setShowConfirmation(x=>!x)} aria-label={showConfirmation?"Hide confirmed password":"Show confirmed password"} aria-pressed={showConfirmation} className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 rounded-lg p-2 text-[#64748B] transition-colors hover:bg-[#F5F6FA] hover:text-[#14253D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF]">{showConfirmation?<EyeOff size={18}/>:<Eye size={18}/>}</button>
     </div>
     {confirmation&&<p role="status" className={"mt-2 flex items-center gap-1.5 text-xs "+(confirmation===password?"text-[#317054]":"text-[#925B55]")}>{confirmation===password?<CheckCircle2 size={14}/>:<AlertCircle size={14}/>} {confirmation===password?"Passwords match":"Passwords do not match yet"}</p>}
    </div>
   </>}
   {!token&&<p role="alert" className="rounded-xl border border-[#E8D1CE] bg-[#FCF6F5] p-3 text-sm text-[#925B55]">This recovery link is missing or invalid. Please request a new one.</p>}
   {attempted&&reset&&!valid&&<p role="alert" className="flex items-center gap-2 text-sm text-[#925B55]"><AlertCircle size={16}/>Meet all password requirements and confirm your password.</p>}
   <button disabled={pending||!token||(reset&&!valid)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#635BFF] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#544CE4] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#635BFF]/20 disabled:cursor-not-allowed disabled:bg-[#B6BECC] motion-reduce:transform-none">{pending?<><Loader2 size={17} className="animate-spin"/>Updating...</>:<>{reset?"Update password":"Activate email"}<ArrowRight size={17}/></>}</button>
  </form>}
  {notice&&<div role="status" className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#CCE5D8] bg-[#F4FAF7] p-4 text-sm leading-6 text-[#317054]"><CheckCircle2 size={19} className="mt-0.5 shrink-0"/>{notice}</div>}
  {error&&<div role="alert" className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#E8D1CE] bg-[#FCF6F5] p-4 text-sm leading-6 text-[#925B55]"><AlertCircle size={19} className="mt-0.5 shrink-0"/>{error}</div>}
  <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#5145A8] hover:underline"><ArrowLeft size={16}/>Back to login</Link>
 </section></main>;
}
