"use client";
import {FormEvent,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {signIn} from "next-auth/react";
import {ArrowRight,Eye,EyeOff,ShieldCheck} from "lucide-react";
export default function Login(){
 const [useRecovery,setUseRecovery]=useState(false);const [challenge,setChallenge]=useState<{id:string;method:string}|null>(null);const [code,setCode]=useState("");const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [show,setShow]=useState(false);const [error,setError]=useState("");const [pending,setPending]=useState(false);
 const [emailTouched,setEmailTouched]=useState(false);const autoAttempt=useRef("");const verificationRef=useRef<HTMLInputElement>(null);
 const emailValid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254;
 async function finishSignIn(verificationCode=code){
  if(pending||!challenge)return;
  setPending(true);setError("");
  try{
   const result=await signIn("credentials",{email:email.trim(),password,challengeId:challenge.id,...(useRecovery?{recoveryCode:verificationCode}:{code:verificationCode}),redirect:false,callbackUrl:"/dashboard"});
   if(!result?.ok)setError("That code didn't work. Try the next code.");
   else window.location.assign("/dashboard");
  }catch{setError("Couldn't sign in right now. Please try again.")}
  finally{setPending(false)}
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!emailValid||!password||pending)return;
  if(challenge){if(useRecovery?!/^[a-fA-F0-9]{6}-?[a-fA-F0-9]{6}$/.test(code):code.length!==6)return;await finishSignIn();return}
  setPending(true);setError("");
  try{
   const res=await fetch("/api/auth/2fa/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim(),password})});
   const data=await res.json();
   if(!res.ok){setError(data.error??"Could not sign in");return}
   if(data.requires2fa){autoAttempt.current="";setChallenge({id:data.challengeId,method:data.method});return}
   const result=await signIn("credentials",{email:email.trim(),password,redirect:false,callbackUrl:"/dashboard"});
   if(!result?.ok)setError("Couldn't sign in with those details.");
   else window.location.assign("/dashboard");
  }catch{setError("Couldn't sign in right now. Please try again.")}
  finally{setPending(false)}
 }
 useEffect(()=>{if(challenge)verificationRef.current?.focus()},[challenge,useRecovery]);
 useEffect(()=>{
  if(!challenge||useRecovery||code.length!==6||pending||autoAttempt.current===code)return;
  autoAttempt.current=code;
  void finishSignIn(code);
  // One automatic attempt per completed code; editing the code allows another attempt.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[code,challenge,useRecovery,pending]);

 const field="mt-2 w-full rounded-xl border border-[#E8EAF5] px-4 py-3.5 text-[#14253D] outline-none transition focus:border-[#14253D] focus:ring-4 focus:ring-[#E6E6F3]/30";
 return <main className="min-h-screen lg:grid lg:grid-cols-2 bg-white"><aside className="hidden lg:flex relative flex-col justify-between bg-[#14253D] p-14 xl:p-20 text-white overflow-hidden"><div className="absolute h-96 w-96 rounded-full bg-[#14253D] blur-[100px] -right-32 top-24 opacity-70"/><Link href="/" className="relative text-3xl font-black tracking-tight">zenvest<span className="text-[#5145A8]">.</span></Link><div className="relative max-w-lg"><p className="text-[#5145A8] uppercase tracking-[.2em] text-xs font-bold">YOUR INVESTOR ACCOUNT</p><h2 className="text-5xl xl:text-6xl tracking-[-.06em] font-semibold leading-[1.08] mt-5">A clearer view of your investments.</h2><p className="mt-7 text-lg leading-8 text-white/65">The right information, thoughtfully organized. Pick up where you left off.</p><div className="flex items-center gap-3 mt-12 border-t border-white/20 pt-8 text-sm text-[#E6E6F3]"><ShieldCheck size={20}/> Protected account access.</div></div><span className="relative text-sm text-white/40">© Zenvest</span></aside><section className="flex items-center justify-center px-5 sm:px-10 py-12 lg:py-16"><div className="w-full max-w-[450px]"><Link href="/" className="lg:hidden text-3xl font-black text-[#14253D]">zenvest.</Link><p className="text-[#5145A8] mt-4 leading-7">Sign in to your Zenvest account.</p><form noValidate className="space-y-5 mt-9" onSubmit={submit}><label className="block text-sm font-semibold text-[#14253D]">Email address<input className={field} type="email" autoComplete="email" placeholder="you@example.com" value={email} disabled={!!challenge} onBlur={()=>setEmailTouched(true)} onChange={e=>setEmail(e.target.value)} required/>{emailTouched&&email.length>0&&!emailValid&&<span className="mt-2 block text-xs text-[#b34d48]">Enter a valid email address</span>}</label><label className="block text-sm font-semibold text-[#14253D]">Password<div className="relative"><input className={field+" pr-14"} type={show?"text":"password"} autoComplete="current-password" placeholder="Your password" value={password} disabled={!!challenge} onChange={e=>setPassword(e.target.value)} required/><button className="absolute right-4 top-[25px] text-[#5145A8]" type="button" disabled={!!challenge} onClick={()=>setShow(!show)} aria-label={show?"Hide password":"Show password"}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>{challenge&&<div className="rounded-xl bg-[#F3F5FA] px-4 py-3 text-xs text-[#536783]">Email and password confirmed. <button type="button" className="font-semibold underline underline-offset-2" onClick={()=>{setChallenge(null);setCode("");setUseRecovery(false);setError("");autoAttempt.current=""}}>Change details</button></div>}{challenge&&<label className="block text-sm font-semibold text-[#14253D]">{useRecovery?"Recovery code":"Verification code"}<input ref={verificationRef} className={field+(useRecovery?"":" text-center font-mono text-xl tracking-[.22em] tabular-nums")} inputMode={useRecovery?"text":"numeric"} autoComplete={useRecovery?"off":"one-time-code"} maxLength={useRecovery?13:7} placeholder={useRecovery?"Recovery code":"000 000"} value={useRecovery?code:code.length>3?code.slice(0,3)+" "+code.slice(3):code} onChange={e=>{const next=useRecovery?e.target.value.toUpperCase().slice(0,13):e.target.value.replace(/\D/g,"").slice(0,6);setCode(next);setError("");if(next!==code)autoAttempt.current=""}} required/><span className="mt-1 block text-xs text-[#64748B]">{useRecovery?"Use a saved backup code.":challenge.method==="EMAIL"?"Check your email for your code.":"Enter the code from your authenticator app."}</span><button type="button" className="mt-2 text-xs underline" onClick={()=>{setUseRecovery(!useRecovery);setCode("");setError("");autoAttempt.current=""}}>{useRecovery?"Use six-digit code":"Use a recovery code instead"}</button></label>}{!challenge&&<div className="flex flex-wrap justify-between gap-3 text-sm"><Link href="/forgot-password" className="text-[#14253D] font-semibold">Forgot password?</Link></div>}{error&&<p role="alert" className="rounded-lg bg-[#F1F3F8] px-3 py-2.5 text-sm text-[#52617B]">{error}</p>}<button disabled={!emailValid||!password||pending||(!!challenge&&!(useRecovery? /^[a-fA-F0-9]{6}-?[a-fA-F0-9]{6}$/.test(code):code.length===6))} className="w-full rounded-xl bg-[#14253D] text-white py-4 font-bold inline-flex items-center justify-center gap-3 hover:bg-[#14253D] disabled:opacity-45">{pending?"Checking…":challenge?"Verify code":"Log in"}<ArrowRight size={18}/></button></form><p className="mt-7 text-center text-sm text-[#5145A8]">New to Zenvest? <Link className="text-[#14253D] font-bold" href="/register">Register</Link></p><p className="mt-10 text-xs text-[#5145A8]">Protected sign in. <Link className="underline" href="/privacy">Privacy notice</Link></p></div></section></main>;
}