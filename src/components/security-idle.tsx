"use client";
import {useEffect,useRef,useState} from "react";
import {signOut} from "next-auth/react";
const TIMEOUT=30*60*1000,WARNING=60*1000;
export function SecurityIdle(){
 const last=useRef(Date.now()),sent=useRef(0),[left,setLeft]=useState(TIMEOUT);
 useEffect(()=>{
  const activity=()=>{const now=Date.now();if(now-last.current>TIMEOUT)return;last.current=now;if(now-sent.current>60_000){sent.current=now;fetch("/api/session/activity",{method:"POST",cache:"no-store"}).then(r=>{if(r.status===401)void signOut({callbackUrl:"/login?expired=1"})}).catch(()=>{})}};
  const events=["pointerdown","keydown","touchstart","scroll"] as const;
  for(const e of events)window.addEventListener(e,activity,{passive:true});
  const timer=window.setInterval(()=>{const remain=TIMEOUT-(Date.now()-last.current);setLeft(remain);if(remain<=0)void signOut({callbackUrl:"/login?expired=1"})},1000);
  return()=>{for(const e of events)window.removeEventListener(e,activity);window.clearInterval(timer)}
 },[]);
 if(left>WARNING||left<=0)return null;
 return <div role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-description" className="fixed inset-x-4 bottom-24 z-[100] mx-auto max-w-sm rounded-2xl border border-[#E4E9F0] bg-white p-5 text-[#14253D] shadow-[0_18px_60px_-22px_rgba(20,37,61,0.3)] sm:p-6"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0EEFF] text-[#635BFF]"><span aria-hidden="true" className="text-xl">◷</span></div><p id="idle-title" className="text-lg font-semibold tracking-tight">Still here?</p><p id="idle-description" className="mt-2 text-sm leading-6 text-[#64748B]">For your security, you’ll be signed out in <span className="font-semibold tabular-nums text-[#14253D]">{Math.ceil(left/1000)} seconds</span> unless you stay signed in.</p><button className="mt-5 w-full rounded-xl bg-[#635BFF] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#544CE4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#635BFF]/20" onClick={()=>{last.current=Date.now();sent.current=Date.now();void fetch("/api/session/activity",{method:"POST"}).then(r=>{if(r.status===401)void signOut({callbackUrl:"/login?expired=1"})})}}>Stay signed in</button></div>
}
