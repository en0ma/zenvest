"use client";
import {useEffect,useState} from "react";
import {signOut} from "next-auth/react";
import QRCode from "qrcode";

export function TwoFactorSettings({enabled,method}:{enabled:boolean;method:string|null}){
 const [useRecovery,setUseRecovery]=useState(false);
 const [recoveryCodes,setRecoveryCodes]=useState<string[]>([]);
 const [choice,setChoice]=useState<"APP"|"EMAIL">("APP");
 const [password,setPassword]=useState("");
 const [code,setCode]=useState("");
 const [challenge,setChallenge]=useState("");
 const [secret,setSecret]=useState("");
 const [uri,setUri]=useState("");
 const [qr,setQr]=useState("");
 const [copied,setCopied]=useState(false);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);

 useEffect(()=>{
  let active=true;
  setQr("");
  if(!uri||!secret)return;
  // Generate on the user's device: never send the TOTP secret to an external QR service.
  QRCode.toDataURL(uri,{errorCorrectionLevel:"M",margin:2,width:240,color:{dark:"#202B4A",light:"#FFFFFF"}})
   .then(url=>{if(active)setQr(url)}).catch(()=>{if(active)setQr("")});
  return ()=>{active=false};
 },[uri,secret]);

 async function copyKey(){
  try{await navigator.clipboard.writeText(secret);setCopied(true)}
  catch{setMessage("Copy isn't available here. Select the key to copy it manually.")}
 }
 async function act(action:string){
  if(busy)return;
  setBusy(true);setMessage("");setCopied(false);
  try{
   const res=await fetch("/api/account/2fa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,password,method:choice,challengeId:challenge,code})});
   const data=await res.json();
   if(!res.ok){setMessage(data.error??"Please try again.");return}
   if(data.challengeId)setChallenge(data.challengeId);
   if(data.secret){setSecret(data.secret);setCode("")}
   if(data.uri)setUri(data.uri);
   if(data.recoveryCodes){setRecoveryCodes(data.recoveryCodes);setPassword("");setSecret("");setUri("");setMessage("Save these recovery codes now. Each code can be used once.");return}
   if(data.loginRequired){await signOut({callbackUrl:"/login"});return}
   if(action==="setup"&&data.method==="EMAIL")setMessage("Enter the code sent to your email.");
   if(action==="disable-code")setMessage("Enter the code sent to your email.");
  }catch{setMessage("Couldn't complete the request. Please try again.")}finally{setBusy(false)}
 }
 const input="mt-2 w-full rounded-xl border border-[#DDE3EE] bg-white px-4 py-3 text-sm text-[#243553] outline-none focus:border-[#7778D6] focus:ring-2 focus:ring-[#D9DDF5]";
 const button="inline-flex min-h-11 items-center justify-center rounded-full bg-[#202B4A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#35446C] disabled:cursor-not-allowed disabled:opacity-40";
 if(recoveryCodes.length)return <div className="space-y-4 py-5">
  <h3 className="text-lg font-semibold text-[#243553]">Save your recovery codes</h3>
  <p className="text-sm text-[#62738B]">Keep these somewhere safe. Each code works only once and will not be shown again.</p>
  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F2F3FB] p-4 font-mono text-xs sm:text-sm">{recoveryCodes.map(c=><span key={c}>{c}</span>)}</div>
  <button type="button" className="rounded-full border border-[#CED6E7] px-5 py-2 text-sm font-semibold" onClick={()=>navigator.clipboard.writeText(recoveryCodes.join("\n"))}>Copy recovery codes</button>
  <button type="button" className={button} onClick={()=>void signOut({callbackUrl:"/login"})}>I've saved my codes — sign in again</button>
 </div>;
 return <section className="space-y-5 py-5 text-[#243553]">
  <div><h3 className="text-lg font-semibold">Two-step verification</h3><p className="mt-1 text-sm text-[#68788F]">{enabled?`On · ${method==="APP"?"Authenticator app":"Email"}`:"Off · Protect your account with a second step."}</p></div>
  {!enabled&&<fieldset className="flex flex-wrap gap-3" disabled={!!challenge||busy}><legend className="sr-only">Choose verification method</legend>{([{value:"APP",label:"Authenticator app"},{value:"EMAIL",label:"Email code"}] as const).map(c=><label key={c.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${choice===c.value?"border-[#8178D7] bg-[#F3F1FD]":"border-[#DDE3EE] bg-white"}`}><input type="radio" name="twoFactorMethod" checked={choice===c.value} onChange={()=>{setChoice(c.value);setChallenge("");setSecret("");setUri("");setCode("")}}/>{c.label}</label>)}</fieldset>}
  <label className="block max-w-xl text-sm font-semibold">Confirm your password<input className={input} type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
  {!enabled&&!challenge&&<button type="button" disabled={!password||busy} className={button} onClick={()=>act("setup")}>{busy?"Setting up…":"Continue"}</button>}
  {!enabled&&choice==="APP"&&secret&&<div className="space-y-5 rounded-2xl border border-[#DCE2F0] bg-[#F6F7FC] p-4 sm:p-6">
   <div><p className="text-xs font-semibold uppercase tracking-widest text-[#6864BD]">Step 2 of 3</p><h4 className="mt-2 text-lg font-semibold">Connect your authenticator app</h4><p className="mt-2 text-sm leading-6 text-[#63738A]">In Authy or another authenticator, add an account by scanning this QR code.</p></div>
   <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
    <div className="flex h-[212px] w-[212px] shrink-0 items-center justify-center rounded-2xl border border-[#E0E5EE] bg-white p-2">{qr?<img src={qr} width={192} height={192} alt="Scan to add Zenvest to your authenticator app" className="h-48 w-48"/>:<p className="p-3 text-center text-xs text-[#63738A]">Use the setup key below</p>}</div>
    <div className="min-w-0 space-y-3"><p className="text-sm font-semibold">Can't scan the code?</p><p className="text-sm leading-6 text-[#63738A]">Enter this key manually. Choose a time-based, six-digit code.</p><div className="rounded-xl border border-[#DEE3EF] bg-white p-3"><code className="block break-all font-mono text-sm font-semibold leading-7 tracking-[.11em] text-[#243553] select-all">{secret.match(/.{1,4}/g)?.join(" ")}</code></div><button type="button" className="rounded-full border border-[#C8D1E5] bg-white px-4 py-2 text-sm font-semibold text-[#283959] hover:bg-[#F0F3FA]" onClick={()=>void copyKey()}>{copied?"Copied!":"Copy setup key"}</button><p className="text-xs text-[#6D7B90]">Keep the setup key private. Anyone with it can generate your login codes.</p></div>
   </div>
   {!enabled&&challenge&&<div className="mt-5 border-t border-[#E1E6F0] pt-4"><button type="button" disabled={busy} className="text-xs font-medium text-[#68788F] underline underline-offset-4 hover:text-[#243553] disabled:opacity-40" onClick={()=>{setChallenge("");setSecret("");setUri("");setCode("");setMessage("");setCopied(false)}}>Need to restart setup?</button></div>}
  </div>}
  {(challenge||enabled&&(method==="APP"||useRecovery))&&<label className="block max-w-xl text-sm font-semibold">{useRecovery?"Recovery code":"Six-digit verification code"}<input className={input} inputMode={useRecovery?"text":"numeric"} autoComplete={useRecovery?"off":"one-time-code"} placeholder={useRecovery?"Recovery code":"000000"} maxLength={useRecovery?13:6} value={code} onChange={e=>setCode(useRecovery?e.target.value.toUpperCase().slice(0,13):e.target.value.replace(/\D/g,"").slice(0,6))}/></label>}
  {enabled&&<button type="button" className="text-xs font-medium underline" onClick={()=>{setUseRecovery(!useRecovery);setCode("");setChallenge("")}}>{useRecovery?"Use verification code":"Use a recovery code instead"}</button>}
  <div className="flex flex-wrap gap-3">
   
   {!enabled&&challenge&&<button type="button" disabled={!password||code.length!==6||busy} onClick={()=>act("enable")} className={button}>{busy?"Verifying…":"Turn on verification"}</button>}
   {enabled&&method==="EMAIL"&&!challenge&&!useRecovery&&<button type="button" disabled={!password||busy} onClick={()=>act("disable-code")} className={button}>Send a code to turn off</button>}
   {enabled&&(method==="APP"||!!challenge||useRecovery)&&<button type="button" disabled={!password||!(useRecovery?/^[A-F0-9]{6}-?[A-F0-9]{6}$/.test(code):code.length===6)||busy} onClick={()=>act("disable")} className={button}>Turn off verification</button>}
  </div>
  {message&&<p role="status" className="rounded-xl bg-[#EEF0FA] p-3 text-sm leading-6 text-[#405173]">{message}</p>}
 </section>;
}
