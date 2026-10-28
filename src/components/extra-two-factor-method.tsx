"use client";
import {useEffect,useState} from "react";
import {signOut} from "next-auth/react";
import QRCode from "qrcode";
import {ChevronDown} from "lucide-react";

type Method="EMAIL"|"APP";
export function ExtraTwoFactorMethod({defaultMethod,methods}:{defaultMethod:Method;methods:Method[]}){
 const [selected,setSelected]=useState<Method|null>(null);
 const [operation,setOperation]=useState<"add"|"default"|"remove"|null>(null);
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
   else if(action==="remove-method-code"){setMessage("Enter the code sent to your email to remove this method.")}
   else if(action==="add-method"){setMessage(method==="EMAIL"?"Enter the code we sent to your email.":"Scan the QR code, then enter the six-digit code from your authenticator app.")}
  }catch{setMessage("Couldn't complete the request. Try again.")}finally{setBusy(false)}
 }
 function cancel(){setOperation(null);setSelected(null);setPassword("");setCode("");setChallenge("");setSecret("");setUri("");setQr("");setMessage("")}
 return <section aria-labelledby="two-step-heading" className="space-y-4">
  <div><h3 id="two-step-heading" className="text-lg font-semibold text-[#14253D]">Two-step verification</h3><p className="mt-1 text-sm text-[#64748B]">Choose how you verify it’s you when signing in.</p></div>
  <div className="overflow-hidden rounded-2xl border border-[#DFE5EF] bg-white">
   <div className="divide-y divide-[#E8ECF3]">{(["APP","EMAIL"] as const).map(m=><div key={m}>
    <button type="button" disabled={busy} aria-expanded={selected===m} aria-controls={"two-factor-panel-"+m.toLowerCase()} className="flex w-full items-center justify-between gap-4 px-4 py-5 text-left transition hover:bg-[#FAFAFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#635BFF] disabled:opacity-60 sm:px-5" onClick={()=>{if(selected===m){cancel();return}cancel();setSelected(m);setOperation(methods.includes(m)?null:"add")}}>
     <span className="min-w-0 flex-1">
      <span className="block text-base font-semibold text-[#14253D]">{m==="APP"?"Authenticator app":"Email code"}</span>
      {methods.includes(m)?<span className="mt-2 flex flex-wrap items-center gap-2">
       <span className="rounded-full bg-[#E8F8F1] px-2.5 py-1 text-xs font-semibold text-[#07875D]">Active</span>
       {m===current&&<span className="rounded-full bg-[#EEF0FA] px-2.5 py-1 text-xs font-semibold text-[#5145A8]">Default</span>}
      </span>:<span className="mt-1 block text-sm text-[#64748B]">Not yet enabled</span>}
     </span>
     <ChevronDown size={20} aria-hidden="true" className={"shrink-0 text-[#52627B] transition-transform "+(selected===m?"rotate-180":"")}/>
    </button>
  {selected===m&&<div id={"two-factor-panel-"+m.toLowerCase()} className="space-y-4 border-t border-[#E8ECF3] bg-[#F7F8FC] p-4 sm:p-5">
   <h5 className="text-sm font-semibold text-[#14253D]">{methods.includes(selected)?"Manage "+(selected==="APP"?"authenticator app":"email code"):"Add "+(selected==="EMAIL"?"email verification":"authenticator app")}</h5>
   {methods.includes(selected)&&!operation&&<div className="space-y-2">
    <p className="text-xs leading-5 text-[#64748B]">{selected===current?"This is your default sign-in method.":"This method is ready to use."}</p>
    {selected!==current&&<button type="button" className="block w-full rounded-xl border border-[#DCE3EC] p-3 text-left text-sm font-semibold text-[#14253D]" onClick={()=>setOperation("default")}>Make default</button>}
    <button type="button" className="inline-flex min-h-10 items-center rounded-lg border border-[#E8D1CE] bg-white px-4 py-2.5 text-sm font-semibold text-[#925B55] transition hover:bg-[#FCF6F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#925B55]/20" onClick={()=>setOperation("remove")}>{selected==="APP"?"Turn off authenticator":"Turn off email code"}</button>

  </div>}
   {operation&&<>
    {operation==="remove"&&<p className="text-sm leading-6 text-[#925B55]">{methods.length===1?"Removing your only method will turn off two-step verification. You’ll need to sign in again.":"Your remaining method will become the default. You’ll need to sign in again."}</p>}
    <label className="block text-sm font-medium text-[#14253D]">Current password (security check)<input className="mt-2 w-full rounded-lg border border-[#DDE3EE] px-3 py-3" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {qr&&<img src={qr} width={220} height={220} alt="Scan this QR code with your authenticator app"/>}
    {secret&&<div className="space-y-2"><p className="text-xs text-[#64748B]">Or enter this setup key manually:</p><code className="block break-all rounded-lg bg-[#F3F5FA] p-3 text-sm select-all">{secret.match(/.{1,4}/g)?.join(" ")}</code><button type="button" className="text-xs underline" onClick={()=>void navigator.clipboard.writeText(secret)}>Copy setup key</button></div>}
    {(challenge||operation==="remove"&&selected==="APP")&&<label className="block text-sm font-medium text-[#14253D]">Six-digit verification code<input inputMode="numeric" autoComplete="one-time-code" className="mt-2 w-full rounded-lg border border-[#DDE3EE] px-3 py-3" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}/></label>}
    <button type="button" disabled={busy||!password||(operation==="remove"&&(selected==="APP"||!!challenge)&&code.length!==6)||(operation==="add"&&!!challenge&&code.length!==6)} className="w-full rounded-xl bg-[#14253D] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40" onClick={()=>void request(operation==="default"?"set-default":operation==="remove"?(selected==="EMAIL"&&!challenge?"remove-method-code":"remove-method"):challenge?"confirm-method":"add-method",selected)}>{busy?"Working…":operation==="default"?"Set as default":operation==="remove"?(selected==="EMAIL"&&!challenge?"Send email code":"Remove method"):challenge?"Verify and add":"Continue"}</button>
   </>}
   {message&&<p role="status" className="text-sm text-[#536783]">{message}</p>}
  </div>}
  </div>)}</div>
 </div>
 </section>;
}
