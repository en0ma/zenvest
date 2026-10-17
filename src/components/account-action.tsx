"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
export function RequestLink({purpose}:{purpose:"VERIFY_EMAIL"|"RESET_PASSWORD"}){
 const [notice,setNotice]=useState("");const [pending,setPending]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setPending(true);
 const email=new FormData(e.currentTarget).get("email");
 try{await fetch("/api/account/request-link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,purpose})});setNotice("If your account is eligible, you will receive an email shortly.");}
 catch{setNotice("Request could not be submitted.")}finally{setPending(false)}}
 return <main className="min-h-screen flex items-center justify-center bg-canvas p-6"><section className="max-w-md w-full bg-white p-9 rounded-2xl shadow-soft"><Link href="/" className="text-3xl font-bold text-forest">zenvest.</Link><h1 className="text-2xl mt-7 font-semibold">{purpose==="VERIFY_EMAIL"?"Resend activation email":"Forgot password"}</h1><form className="mt-6 space-y-4" onSubmit={submit}><label className="text-sm block">Account email<input required type="email" name="email" autoComplete="email" className="w-full mt-2 border rounded-lg p-3"/></label><button disabled={pending} className="w-full p-3 rounded-lg bg-forest text-white disabled:opacity-50">Send link</button></form>{notice&&<p role="status" className="mt-5 text-sm">{notice}</p>}<Link className="text-sm text-forest underline block mt-5" href="/login">Back to login</Link></section></main>;
}
export function ConfirmLink({purpose,token}:{purpose:"VERIFY_EMAIL"|"RESET_PASSWORD";token:string}){
 const [notice,setNotice]=useState("");const [pending,setPending]=useState(false);const [ok,setOk]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setPending(true);
 const password=purpose==="RESET_PASSWORD"?new FormData(e.currentTarget).get("password"):undefined;
 try{const res=await fetch("/api/account/confirm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,purpose,...(password?{password}:{})})});const data=await res.json();setOk(res.ok);setNotice(res.ok?"Success. You can sign in now.":data.error??"Invalid or expired link.");}
 catch{setNotice("Could not complete request.")}finally{setPending(false)}}
 return <main className="min-h-screen flex items-center justify-center bg-canvas p-6"><section className="max-w-md w-full bg-white p-9 rounded-2xl shadow-soft"><Link href="/" className="text-3xl font-bold text-forest">zenvest.</Link><h1 className="text-2xl mt-7 font-semibold">{purpose==="VERIFY_EMAIL"?"Activate your account":"Set a new password"}</h1>{!ok&&<form className="mt-6 space-y-4" onSubmit={submit}>{purpose==="RESET_PASSWORD"&&<label className="text-sm block">New password (5–15 characters, uppercase, number and symbol)<input required type="password" name="password" minLength={5} maxLength={15} autoComplete="new-password" className="w-full mt-2 border rounded-lg p-3"/></label>}<button disabled={pending||!token} className="w-full p-3 rounded-lg bg-forest text-white disabled:opacity-50">{purpose==="VERIFY_EMAIL"?"Activate email":"Reset password"}</button></form>}{notice&&<p role="status" className="mt-4 text-sm">{notice}</p>}<Link href="/login" className="mt-5 block text-sm text-forest underline">Back to login</Link></section></main>;
}
