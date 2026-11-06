"use client";
import {useEffect,useState} from "react";
import QRCode from "qrcode";
type Method="APP"|"EMAIL";
export function StaffLoginEnrollment({email,password,onRestart}:{email:string;password:string;onRestart:()=>void}){
 const [method,setMethod]=useState<Method>("APP");
 const [challengeId,setChallengeId]=useState("");
 const [secret,setSecret]=useState("");
 const [uri,setUri]=useState("");
 const [qr,setQr]=useState("");
 const [code,setCode]=useState("");
 const [codes,setCodes]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{let active=true;setQr("");if(uri)QRCode.toDataURL(uri,{width:220,margin:2}).then(x=>{if(active)setQr(x)}).catch(()=>{});return()=>{active=false}},[uri]);
 async function advance(){
  if(busy)return;
  setBusy(true);setError("");
  try{
   const res=await fetch("/api/auth/2fa/staff-enroll",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:challengeId?"confirm":"setup",email,password,method,challengeId,code})});
   const data=await res.json();
   if(!res.ok){setError(data.error??"Could not complete verification");return}
   if(Array.isArray(data.recoveryCodes)){setCodes(data.recoveryCodes);setSecret("");setUri("");setCode("");return}
   setChallengeId(data.challengeId);setSecret(data.secret??"");setUri(data.uri??"");setCode("");
  }catch{setError("Couldn't complete enrollment. Try again.")}finally{setBusy(false)}
 }
 const button="w-full rounded-xl bg-[#14253D] px-5 py-3.5 font-semibold text-white disabled:opacity-40";
 return <section className="mt-9 space-y-5 text-[#14253D]" aria-labelledby="staff-enroll-heading">
  <h2 id="staff-enroll-heading" className="text-xl font-semibold">Secure your staff account</h2>
  <p className="text-sm leading-6 text-[#64748B]">Staff access requires two-step verification. Set it up before you can sign in. Your regular investor account settings remain unchanged.</p>
  {codes.length>0?<>
   <h3 className="font-semibold">Save your recovery codes</h3>
   <p className="text-sm text-[#64748B]">Each backup code can be used only once. Store them somewhere private; they won't be shown again.</p>
   <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F5F7FA] p-4 font-mono text-xs">{codes.map(item=><span key={item}>{item}</span>)}</div>
   <button type="button" className={button} onClick={onRestart}>I've saved my codes — sign in with 2FA</button>
  </>:<>
   {!challengeId&&<fieldset className="flex flex-wrap gap-3"><legend className="mb-2 text-sm font-semibold">Verification method</legend>{(["APP","EMAIL"] as const).map(m=><label key={m} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="radio" checked={method===m} onChange={()=>setMethod(m)}/>{m==="APP"?"Authenticator app":"Email code"}</label>)}</fieldset>}
   {challengeId&&<>
    {method==="APP"?<div className="space-y-3"><p className="text-sm">Scan this QR code with your authenticator app, or enter the setup key.</p>{qr?<img src={qr} width={220} height={220} alt="Authenticator enrollment QR code"/>:<p className="text-xs">Use the setup key below</p>}<code className="block break-all rounded-lg bg-[#F5F7FA] p-3 text-sm select-all">{secret.match(/.{1,4}/g)?.join(" ")}</code></div>:<p className="text-sm">Enter the six-digit verification code sent to your email.</p>}
    <label className="block text-sm font-semibold">Verification code<input aria-label="Six-digit verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} className="mt-2 w-full rounded-lg border px-4 py-3"/></label>
   </>}
   {error&&<p role="alert" className="rounded-lg bg-[#FFF0F0] p-3 text-sm text-red-700">{error}</p>}
   <button type="button" className={button} disabled={busy||(!!challengeId&&code.length!==6)} onClick={()=>void advance()}>{busy?"Working…":challengeId?"Verify and enable 2FA":"Set up two-step verification"}</button>
   {challengeId&&<button type="button" className="block text-sm underline" onClick={()=>{setChallengeId("");setCode("");setSecret("");setUri("");setError("")}}>Restart setup</button>}
   <button type="button" className="block text-sm text-[#64748B] underline" onClick={onRestart}>Back to login</button>
  </>}
 </section>;
}
