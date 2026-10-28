"use client";
import {useEffect,useState} from "react";
import {signOut} from "next-auth/react";
import QRCode from "qrcode";

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
  <div className="space-y-3 rounded-2xl border border-[#DFE5EF] bg-[#F7F8FC] p-4 sm:p-5">
  <div><h4 className="text-sm font-semibold text-[#14253D]">Verification methods</h4><p className="mt-1 text-xs text-[#64748B]">{methods.length===1?"Your first method is the default. Add the other method for a backup option.":"Both methods are ready. The default is used first at sign-in."}</p></div>
  <div className="space-y-3">{(["APP","EMAIL"] as const).map(m=><div key={m} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E3E8F0] bg-white p-4">
   <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#14253D]">{m==="APP"?"Authenticator app":"Email code"}</p><p className="mt-1 text-xs text-[#64748B]">{methods.includes(m)?m===current?"Your default sign-in method":"Added and ready to use":"Not yet connected"}</p></div>
   <div className="flex shrink-0 items-center gap-2">
    {methods.includes(m)&&m===current&&<span className="rounded-full bg-[#EEF0FA] px-3 py-2 text-xs font-semibold text-[#5145A8]">Default</span>}
    {!selected&&<button type="button" className="rounded-full border border-[#CCD4E5] bg-white px-3 py-2 text-xs font-semibold text-[#344561] hover:bg-[#F3F5FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF]" onClick={()=>{cancel();setSelected(m);setOperation(methods.includes(m)?null:"add")}}>{methods.includes(m)?"Manage":"Add method"}</button>}
   </div>
  {selected===m&&<div className="mt-4 w-full space-y-4 border-t border-[#E3E8F0] pt-4">
   <div className="flex items-center justify-between gap-3"><h5 className="text-sm font-semibold text-[#14253D]">{methods.includes(selected)?"Manage "+(selected==="APP"?"authenticator app":"email code"):"Add "+(selected==="EMAIL"?"email verification":"authenticator app")}</h5><button type="button" onClick={cancel} disabled={busy} className="text-xs underline">Cancel</button></div>
   {methods.includes(selected)&&!operation&&<div className="space-y-2">
    <p className="text-xs leading-5 text-[#64748B]">{selected===current?"This is your default sign-in method.":"This method is ready to use."}</p>
    {selected!==current&&<button type="button" className="block w-full rounded-xl border border-[#DCE3EC] p-3 text-left text-sm font-semibold text-[#14253D]" onClick={()=>setOperation("default")}>Make default</button>}
    {methods.length>1&&<button type="button" className="block w-full rounded-xl border border-[#E8D1CE] p-3 text-left text-sm font-semibold text-[#925B55]" onClick={()=>setOperation("remove")}>Remove this method</button>}
    {methods.length===1&&<p className="text-xs text-[#64748B]">To remove your only method, use the Turn off two-step verification control below.</p>}
    {message&&<p role="status" className="text-sm text-[#536783]">{message}</p>}
  </div>}
   {operation&&<>
    {operation==="remove"&&<p className="text-sm leading-6 text-[#925B55]">Remove this method? Your other verified method will become the default. You’ll need to sign in again.</p>}
    <label className="block text-sm font-medium text-[#14253D]">Confirm your password<input className="mt-2 w-full rounded-lg border border-[#DDE3EE] px-3 py-3" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
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
