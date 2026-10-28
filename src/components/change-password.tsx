"use client";
import {FormEvent,useState} from "react";
import {signOut} from "next-auth/react";
import {Eye,EyeOff,CheckCircle2} from "lucide-react";
import {passwordChecks,isValidPassword} from "@/lib/password-policy";
export function ChangePassword(){
 const [expanded,setExpanded]=useState(false);
 const [current,setCurrent]=useState("");
 const [next,setNext]=useState("");
 const [confirm,setConfirm]=useState("");
 const [visible,setVisible]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const field="mt-2 w-full rounded-xl border border-[#DCE3EC] bg-white px-4 py-3 text-sm text-[#14253D] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15";
 function close(){setExpanded(false);setCurrent("");setNext("");setConfirm("");setError("");setVisible(false)}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy||!current||!isValidPassword(next)||next!==confirm)return;
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/account/change-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currentPassword:current,newPassword:next})});
   const data=await response.json();
   if(!response.ok){setError(data.error??"Could not update your password.");return}
   await signOut({redirect:false});
   window.location.replace(window.location.origin+"/login");
  }catch{setError("Could not update your password. Try again.")}finally{setBusy(false)}
 }
 return <section aria-labelledby="password-settings-title" className="rounded-2xl border border-[#E2E7EF] bg-white p-4 sm:p-6">
  <div className="flex items-center justify-between gap-3">
   <div className="min-w-0"><h2 id="password-settings-title" className="text-base font-semibold text-[#14253D]">Password</h2><p className="mt-1 text-sm text-[#64748B]">Change the password you use to sign in.</p></div>
   <button type="button" aria-expanded={expanded} aria-controls="password-change-panel" onClick={()=>expanded?close():setExpanded(true)} className="shrink-0 rounded-full border border-[#CCD4E5] px-4 py-2 text-sm font-semibold text-[#344561] hover:bg-[#F3F5FA]">{expanded?"Close":"Change"}</button>
  </div>
  {expanded&&<form id="password-change-panel" onSubmit={submit} className="mt-5 space-y-4 border-t border-[#E8ECF3] pt-5">
   <label className="block text-sm font-semibold text-[#14253D]">Current password<input type={visible?"text":"password"} autoComplete="current-password" required value={current} onChange={e=>setCurrent(e.target.value)} className={field}/></label>
   <label className="block text-sm font-semibold text-[#14253D]">New password<input type={visible?"text":"password"} autoComplete="new-password" required value={next} onChange={e=>setNext(e.target.value)} className={field}/></label>
   <label className="block text-sm font-semibold text-[#14253D]">Confirm new password<input type={visible?"text":"password"} autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)} className={field}/></label>
   <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-[#5145A8]" aria-pressed={visible} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={16}/>:<Eye size={16}/>} {visible?"Hide passwords":"Show passwords"}</button>
   <div className="rounded-xl bg-[#F7F8FC] p-3"><p className="text-xs font-semibold text-[#52627B]">Password requirements</p><ul className="mt-2 space-y-1">{passwordChecks(next).map(item=><li key={item.label} className={"flex items-center gap-2 text-xs "+(item.passed?"text-[#07875D]":"text-[#64748B]")}><CheckCircle2 size={13}/>{item.label}</li>)}</ul></div>
   {confirm.length>0&&confirm!==next&&<p className="text-xs text-[#925B55]">Passwords don't match yet.</p>}
   {error&&<p role="alert" className="rounded-lg bg-[#FCF6F5] p-3 text-sm text-[#925B55]">{error}</p>}
   <button type="submit" disabled={busy||!current||!isValidPassword(next)||next!==confirm} className="w-full rounded-xl bg-[#14253D] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy?"Updating…":"Update password"}</button>
   <p className="text-xs leading-5 text-[#64748B]">You'll be asked to sign in again after updating your password.</p>
  </form>}
 </section>
}
