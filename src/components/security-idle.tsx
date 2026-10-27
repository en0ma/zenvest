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
 return <div role="alertdialog" aria-label="Session ending soon" className="fixed bottom-20 left-4 right-4 z-[100] mx-auto max-w-sm rounded-xl border border-[#E3E8EE] bg-white p-4 shadow-xl"><p className="font-semibold">Still here?</p><p className="mt-1 text-sm text-[#64748B]">You'll be signed out in {Math.ceil(left/1000)} seconds to keep your account secure.</p><button className="mt-3 rounded-lg bg-[#14253D] px-4 py-2 text-sm font-semibold text-white" onClick={()=>{last.current=Date.now();sent.current=Date.now();void fetch("/api/session/activity",{method:"POST"}).then(r=>{if(r.status===401)void signOut({callbackUrl:"/login?expired=1"})})}}>Stay signed in</button></div>
}
