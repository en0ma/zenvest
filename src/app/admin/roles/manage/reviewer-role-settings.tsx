"use client";
import {useState} from "react";
import Link from "next/link";
export default function ReviewerRoleSettings({initialRoles,roles}:{initialRoles:string[];roles:string[]}){
 const [enabled,setEnabled]=useState<string[]>(initialRoles);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState(""),[reauth,setReauth]=useState(false);
 function toggle(key:string,checked:boolean){setEnabled(current=>checked?[...current.filter(x=>x!==key),key]:current.filter(x=>x!==key))}
 async function save(){
  if(busy)return;
  if(!window.confirm("Update which staff roles may approve or reject another administrator's action? Super Admin remains an approver."))return;
  setBusy(true);setMessage("");setError("");setReauth(false);
  try{
   const response=await fetch("/api/admin/approval-policy",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({additionalRoleKeys:enabled})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok){if(response.status===401&&result.code==="STAFF_REAUTH_REQUIRED")setReauth(true);throw new Error(result.error??"Unable to update reviewer policy")}
   setEnabled(result.additionalRoleKeys);setMessage("Reviewer roles updated and audited.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to save")}finally{setBusy(false)}
 }
 return <section className="mt-8 max-w-xl space-y-4 rounded-xl border bg-white p-6">
  <h2 className="text-xl font-semibold">Approval reviewer roles</h2>
  <p className="text-sm text-slate-600">Super Admin can always approve or reject another administrator's pending action. By default no other role can review. Select additional reviewer roles below; granting reviewer access does not grant permission to propose or execute transfers. Non-Super Admins cannot approve their own requests. Super Admin actions are self-authorized.</p>
  {roles.map(key=><label key={key} className="flex items-center gap-3 text-sm capitalize"><input type="checkbox" checked={enabled.includes(key)} onChange={e=>toggle(key,e.target.checked)}/>{key}</label>)}
  <button type="button" onClick={save} disabled={busy} className="rounded bg-[#14253D] px-4 py-2 text-white disabled:opacity-50">{busy?"Saving…":"Save reviewer policy"}</button>
  {message&&<p role="status" className="text-sm text-emerald-800">{message}</p>}
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {reauth&&<Link href="/login" className="text-sm text-violet-700 underline">Sign in again</Link>}
 </section>;
}
