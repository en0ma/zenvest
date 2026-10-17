"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
export default function Register() {
 const [error,setError]=useState("");const [pending,setPending]=useState(false);const router=useRouter();
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError("");setPending(true);
  const data=Object.fromEntries(new FormData(event.currentTarget));
  try {
   const response=await fetch("/api/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
   const result=await response.json();
   if (!response.ok){setError(result.error || "Registration failed");return;}
   router.push("/login");
  }catch{setError("Registration unavailable. Try again.");}finally{setPending(false);}
 }
 return <main className="min-h-screen flex items-center justify-center p-6 bg-[#f0f8f2]"><section className="bg-white rounded-[28px] border border-[#d7e9db] shadow-xl w-full max-w-md p-9 md:p-11">
 <Link href="/" className="text-3xl text-forest font-bold">zenvest.</Link><h1 className="text-2xl font-semibold mt-9">Create your account</h1><p className="text-sm text-muted mt-2">Create your reporting account. Verify your email before signing in.</p>
 <form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm">Full name<input required minLength={2} maxLength={120} name="name" autoComplete="name" className="mt-2 w-full border rounded-lg px-4 py-3"/></label>
 <label className="block text-sm">Email<input required type="email" maxLength={254} name="email" autoComplete="email" className="mt-2 w-full border rounded-lg px-4 py-3"/></label>
 <label className="block text-sm">Password (12+ characters)<input required type="password" minLength={12} maxLength={72} name="password" autoComplete="new-password" className="mt-2 w-full border rounded-lg px-4 py-3"/></label>
 {error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}<button disabled={pending} className="w-full bg-forest text-white rounded-lg py-3 disabled:opacity-50">{pending?"Creating account...":"Register"}</button></form>
 <p className="mt-7 text-sm text-muted">Already registered? <Link href="/login" className="text-forest font-semibold">Sign in</Link></p></section></main>;
}
