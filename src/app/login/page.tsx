"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
export default function Login() {
 const [error, setError] = useState("");
 const [pending,setPending] = useState(false);
 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();setPending(true);setError("");
  const form = new FormData(event.currentTarget);
  try {
   const result = await signIn("credentials", {email:form.get("email"),password:form.get("password"),redirect:false,callbackUrl:"/dashboard"});
   if (!result?.ok) setError("Invalid email or password.");
   else window.location.assign("/dashboard");
  } catch { setError("Could not sign in. Try again."); }
  finally {setPending(false);}
 }
 return <main className="min-h-screen flex items-center justify-center p-6 bg-canvas"><section className="bg-white rounded-3xl shadow-soft w-full max-w-md p-9">
 <Link href="/" className="text-3xl text-forest font-bold">zenvest.</Link><h1 className="text-2xl font-semibold mt-9">Welcome back</h1><p className="text-sm text-muted mt-2">Sign in to your Zenvest account.</p>
 <form className="mt-8 space-y-5" onSubmit={submit}><label className="block text-sm">Email<input autoComplete="email" required type="email" name="email" className="w-full mt-2 border rounded-lg px-4 py-3"/></label>
 <label className="block text-sm">Password<input required autoComplete="current-password" type="password" name="password" className="w-full mt-2 border rounded-lg px-4 py-3"/></label>
 {error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}<button disabled={pending} className="w-full bg-forest text-white py-3 rounded-lg disabled:opacity-50">{pending?"Signing in...":"Sign in"}</button></form>
 <p className="mt-7 text-sm text-muted">No account? <Link className="text-forest font-semibold" href="/register">Register</Link></p><p className="mt-4 text-xs text-muted">Demo dashboards only. Real funds are not supported.</p>
 </section></main>;
}
