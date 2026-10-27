"use client";
import {useState} from "react";
import {signOut} from "next-auth/react";
export function TwoFactorSettings({enabled,method}:{enabled:boolean;method:string|null}){
 const [useRecovery,setUseRecovery]=useState(false),[recoveryCodes,setRecoveryCodes]=useState<string[]>([]),[choice,setChoice]=useState<"APP"|"EMAIL">("APP"),[password,setPassword]=useState(""),[code,setCode]=useState(""),[challenge,setChallenge]=useState(""),[secret,setSecret]=useState(""),[uri,setUri]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function act(action:string){
  if(busy)return;setBusy(true);setMessage("");
  try{
   const res=await fetch("/api/account/2fa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,password,method:choice,challengeId:challenge,code})});
   const data=await res.json();
   if(!res.ok){setMessage(data.error??"Please try again");return}
   if(data.challengeId)setChallenge(data.challengeId);
   if(data.secret)setSecret(data.secret);
   if(data.uri)setUri(data.uri);
   if(data.recoveryCodes){setRecoveryCodes(data.recoveryCodes);setMessage("Save these recovery codes now. Each code can be used once.");return}
   if(data.loginRequired){await signOut({callbackUrl:"/login"});return}
   if(action==="setup")setMessage(data.method==="EMAIL"?"Enter the code sent to your email.":"Add this key to your authenticator app, then enter its six-digit code.");
   if(action==="disable-code")setMessage("Enter the code sent to your email.");
  }catch{setMessage("Couldn't complete this request. Please try again.")}finally{setBusy(false)}
 }
 const input="mt-1 w-full rounded-lg border border-[#E2E7EF] px-3 py-2.5 text-sm";
 return recoveryCodes.length?<div className="py-5 space-y-4"><h3 className="text-lg font-semibold">Save your recovery codes</h3><p className="text-sm text-[#64748B]">Keep these in a safe place. They will not be shown again.</p><div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F5F5FF] p-4 font-mono text-sm">{recoveryCodes.map(c=><span key={c}>{c}</span>)}</div><button type="button" className="rounded-lg border px-4 py-2 text-sm font-medium" onClick={()=>navigator.clipboard.writeText(recoveryCodes.join("\n"))}>Copy codes</button><button type="button" className="rounded-lg bg-[#14253D] px-4 py-2 text-sm font-semibold text-white" onClick={()=>void signOut({callbackUrl:"/login"})}>I saved my codes — sign in again</button></div>:<div className="py-5 space-y-4">
  <div><h3 className="font-semibold">Two-step verification</h3><p className="mt-1 text-xs text-[#64748B]">{enabled?`On · ${method==="APP"?"Authenticator app":"Email"}`:"Off · Add an extra step to protect your account."}</p></div>
  {!enabled&&<div className="flex flex-wrap gap-4 text-sm"><label><input type="radio" name="twoFactorMethod" checked={choice==="APP"} onChange={()=>{setChoice("APP");setChallenge("");setSecret("")}}/> Authenticator app</label><label><input type="radio" name="twoFactorMethod" checked={choice==="EMAIL"} onChange={()=>{setChoice("EMAIL");setChallenge("");setSecret("")}}/> Email code</label></div>}
  <label className="block text-sm font-medium">Confirm your password<input className={input} type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
  {secret&&<div className="rounded-lg bg-[#F5F5FF] p-3"><p className="text-sm font-medium">Add Zenvest to your authenticator app</p><p className="mt-2 break-all font-mono text-sm">{secret}</p><p className="mt-2 text-xs text-[#64748B]">In your authenticator app, choose to enter a setup key. Keep this key private.</p><a className="mt-2 inline-block text-xs underline" href={uri}>Open authenticator app</a></div>}
  {(challenge||enabled&&method==="APP"||enabled&&useRecovery)&&<label className="block text-sm font-medium">{useRecovery?"Recovery code":"Six-digit verification code"}<input className={input} inputMode={useRecovery?"text":"numeric"} autoComplete={useRecovery?"off":"one-time-code"} maxLength={useRecovery?13:6} value={code} onChange={e=>setCode(useRecovery?e.target.value.toUpperCase().slice(0,13):e.target.value.replace(/\D/g,"").slice(0,6))}/></label>}
  {enabled&&<button type="button" className="text-xs font-medium underline" onClick={()=>{setUseRecovery(!useRecovery);setCode("");setChallenge("")}}>{useRecovery?"Use verification code":"Use a recovery code instead"}</button>}
  <div className="flex flex-wrap gap-2">
   {!enabled&&!challenge&&<button type="button" disabled={!password||busy} onClick={()=>act("setup")} className="rounded-lg bg-[#14253D] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Set up verification</button>}
   {!enabled&&challenge&&<button type="button" disabled={!password||code.length!==6||busy} onClick={()=>act("enable")} className="rounded-lg bg-[#14253D] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Turn on verification</button>}
   {enabled&&method==="EMAIL"&&!challenge&&!useRecovery&&<button type="button" disabled={!password||busy} onClick={()=>act("disable-code")} className="rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-40">Send a code to turn off</button>}
   {enabled&&(method==="APP"||!!challenge||useRecovery)&&<button type="button" disabled={!password||!(useRecovery?/^[A-F0-9]{6}-?[A-F0-9]{6}$/.test(code):code.length===6)||busy} onClick={()=>act("disable")} className="rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-40">Turn off verification</button>}
  </div>
  {message&&<p role="status" className="text-sm text-[#64748B]">{message}</p>}
 </div>
}
