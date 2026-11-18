"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
export default function RoleManager({roles}:{roles:string[]}){
 const router=useRouter();
 const [userId,setUserId]=useState("");
 const [roleKey,setRoleKey]=useState<string>(roles[0]??"");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [reauth,setReauth]=useState(false);
 async function change(kind:"assign"|"revoke"){
  if(busy||!userId.trim()||!roles.includes(roleKey))return;
  if(!window.confirm(kind==="assign"?"Assign this staff role to the specified account?":"Revoke this staff role and invalidate the user's sessions?"))return;
  setBusy(true);setMessage("");setError("");setReauth(false);
  try{
   const res=await fetch("/api/admin/roles/"+kind,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(roleKey==="bot"?{handle:userId.trim(),roleKey}:{userId:userId.trim(),roleKey})});
   const data=await res.json().catch(()=>({}));
   if(!res.ok){if(res.status===401&&data.code==="STAFF_REAUTH_REQUIRED")setReauth(true);throw new Error(typeof data.error==="string"?data.error:"Role change failed");}
   setMessage(kind==="assign"?"Role assigned and audited.":"Role revoked and sessions invalidated.");
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to update role")}finally{setBusy(false)}
 }
 return <div className="mt-8 max-w-xl space-y-4 rounded-xl border bg-white p-6">
  <h2 className="text-xl font-semibold">Manage staff and bot manager membership</h2>
  <p className="text-sm text-slate-600">Assignable staff roles only. You cannot modify your own membership or assign Super Admin through this interface.</p>
  <label className="block text-sm">{roleKey==="bot"?"Exact Zenvest user handle":"Exact user ID"}<input required maxLength={roleKey==="bot"?8:100} pattern={roleKey==="bot"?"[a-z0-9]{1,8}":undefined} placeholder={roleKey==="bot"?"e.g. trader42":undefined} value={userId} onChange={e=>setUserId(e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
  <label className="block text-sm">Role<select className="mt-1 w-full rounded border p-2" value={roleKey} onChange={e=>(setRoleKey(e.target.value),setUserId(""),setMessage(""),setError(""))}>{roles.map(k=><option value={k} key={k}>{k}</option>)}</select></label>
  <div className="flex gap-3"><button type="button" disabled={busy||!userId.trim()||!roles.includes(roleKey)} onClick={()=>change("assign")} className="rounded bg-[#14253D] px-4 py-2 text-white disabled:opacity-50">Assign role</button><button type="button" disabled={busy||!userId.trim()} onClick={()=>change("revoke")} className="rounded border px-4 py-2 disabled:opacity-50">Revoke role</button></div>
  {message&&<p role="status" className="text-sm text-emerald-800">{message}</p>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{reauth&&<Link href="/login" className="text-sm text-violet-700 underline">Sign in again</Link>}
 </div>;
}
