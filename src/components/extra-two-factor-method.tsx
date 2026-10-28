"use client";
import {useEffect,useState} from "react";
import {signOut} from "next-auth/react";
import QRCode from "qrcode";

type Method="EMAIL"|"APP";
export function ExtraTwoFactorMethod({defaultMethod,methods}:{defaultMethod:Method;methods:Method[]}){
 const [selected,setSelected]=useState<Method|null>(null);
 const [password,setPassword]=useState("");
 const [code,setCode]=useState("");
 const [challenge,setChallenge]=useState("");
 const [secret,setSecret]=useState("");
 const [uri,setUri]=useState("");
 const [qr,setQr]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [current,setCurrent]=useState(defaultMethod);
 useEffect(()=>{if(!uri)return;let active=true;QRCode.toDataURL(uri,{width:220,margin:2}).then(x=>{if(active)setQr(x)}).catch(()=>{if(active)setQr("")});return()=>{active=false}},[uri]);
 async function request(action:string,method:Method){
  if(busy||!password)return;setBusy(true);setMessage("");
  try{
   const res=await fetch("/api/account/2fa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,method,password,challengeId:challenge,code})});
   const data=await res.json();
   if(!res.ok){setMessage(data.error??"Please try again.");return}
   if(data.challengeId)setChallenge(data.challengeId);
   if(data.secret)setSecret(data.secret);
   if(data.uri)setUri(data.uri);
   if(data.loginRequired){await signOut({redirect:false});window.location.replace(window.location.origin+"/");return}
   if(action==="set-default"){setCurrent(method);setSelected(null);setPassword("");setMessage("Default verification method updated.")}
   else if(action==="add-method"){setMessage(method==="EMAIL"?"Enter the code we sent to your email.":"Scan the QR code, then enter the six-digit code from your authenticator app.")}
  }catch{setMessage("Couldn't complete the request. Try again.")}finally{setBusy(false)}
 }
 function cancel(){setSelected(null);setPassword("");setCode("");setChallenge("");setSecret("");setUri("");setQr("");setMessage("")}
 return <div className="space-y-4 rounded-2xl border border-[#DFE5EF] bg-[#F7F8FC] p-4 sm:p-5">
  <h4 className="text-sm font-semibold text-[#14253D]">Verification methods</h4>
  <div className="space-y-2">{(["APP","EMAIL"] as const).map(m=><div key={m} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E3E8F0] bg-white p-3">
   <div><p className="text-sm font-semibold text-[#14253D]">{m==="APP"?"Authenticator app":"Email code"}</p><p className="text-xs text-[#64748B]">{methods.includes(m)?m===current?"Default · Ready to use":"Ready to use":"Not added yet"}</p></div>
   {!selected&&<button type="button" className="rounded-full border border-[#CCD4E5] px-3 py-2 text-xs font-semibold text-[#344561]" onClick={()=>{setSelected(m);setMessage("")}}>{methods.includes(m)?m===current?"Current default":"Make default":"Add method"}</button>}
  </div>)}</div>
  {selected&&<div className="space-y-4 rounded-xl bg-white p-4">
   <div className="flex items-center justify-between gap-3"><h5 className="font-semibold text-sm">{methods.includes(selected)?"Make this your default":"Add "+(selected==="EMAIL"?"email verification":"authenticator app")}</h5><button type="button" onClick={cancel} disabled={busy} className="text-xs underline">Cancel</button></div>
   <label className="block text-sm font-medium">Confirm your password<input className="mt-2 w-full rounded-lg border border-[#DDE3EE] px-3 py-3" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
   {qr&&<img src={qr} width={220} height={220} alt="Scan this QR code with your authenticator app"/>}
   {secret&&<div className="space-y-2"><p className="text-xs text-[#64748B]">Or enter this setup key manually:</p><code className="block break-all rounded-lg bg-[#F3F5FA] p-3 text-sm select-all">{secret.match(/.{1,4}/g)?.join(" ")}</code><button type="button" className="text-xs underline" onClick={()=>void navigator.clipboard.writeText(secret)}>Copy setup key</button></div>}
   {challenge&&<label className="block text-sm font-medium">Six-digit verification code<input inputMode="numeric" autoComplete="one-time-code" className="mt-2 w-full rounded-lg border border-[#DDE3EE] px-3 py-3" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}/></label>}
   <button type="button" disabled={busy||!password||!!challenge&&code.length!==6} className="rounded-full bg-[#14253D] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40" onClick={()=>void request(methods.includes(selected)?"set-default":challenge?"confirm-method":"add-method",selected)}>{busy?"Working…":methods.includes(selected)?"Set as default":challenge?"Verify and add":"Continue"}</button>
  </div>}
  {message&&<p role="status" className="text-sm text-[#536783]">{message}</p>}
 </div>;
}
