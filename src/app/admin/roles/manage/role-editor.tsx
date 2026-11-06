"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
type RoleItem={key:string;editable:boolean;permissionKeys:string[];memberCount:number};
type PermissionItem={key:string;description:string};
export default function RoleEditor({roles,permissions}:{roles:RoleItem[];permissions:PermissionItem[]}){
 const router=useRouter();
 const [mode,setMode]=useState<"create"|"edit">("create");
 const [selected,setSelected]=useState(roles.find(r=>r.editable)?.key??"");
 const [key,setKey]=useState("");
 const [grants,setGrants]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState(""),[reauth,setReauth]=useState(false);
 const available=roles.filter(role=>role.editable);
 useEffect(()=>{if(mode==="edit"){const role=roles.find(r=>r.key===selected);setGrants(role?.permissionKeys.filter(p=>permissions.some(item=>item.key===p))??[])}},[mode,selected,roles,permissions]);
 function flip(permission:string,checked:boolean){setGrants(current=>checked?[...current.filter(p=>p!==permission),permission]:current.filter(p=>p!==permission))}
 async function save(){
  const roleKey=mode==="create"?key.trim().toLowerCase():selected;
  if(!roleKey||busy)return;
  if(!window.confirm(mode==="create"?"Create this role with the selected permissions?":"Replace this role's permissions? Revoked grants take effect immediately for its members."))return;
  setBusy(true);setMessage("");setError("");setReauth(false);
  try{
   const res=await fetch("/api/admin/roles/catalog",{method:mode==="create"?"POST":"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({roleKey,permissionKeys:grants})});
   const data=await res.json().catch(()=>({}));
   if(!res.ok){if(res.status===401&&data.code==="STAFF_REAUTH_REQUIRED")setReauth(true);throw Error(data.error??"Unable to save role")}
   setMessage(mode==="create"?"Role created and audited. Assign it from the staff membership form.":"Role permissions replaced and audited.");
   if(mode==="create"){setKey("");setGrants([])}
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to save role")}finally{setBusy(false)}
 }
 return <section className="mt-8 space-y-4 rounded-xl border bg-white p-6">
  <h2 className="text-xl font-semibold">Role creation and permissions</h2>
  <p className="text-sm text-slate-600">Create staff roles or change which permissions they grant. The mandatory investor role and Super Admin are protected and cannot be edited. Role management itself cannot be granted to another role.</p>
  <div className="flex flex-wrap gap-3">
   <label className="text-sm"><input type="radio" checked={mode==="create"} onChange={()=>{setMode("create");setGrants([])}}/> Create role</label>
   <label className="text-sm"><input type="radio" checked={mode==="edit"} onChange={()=>setMode("edit")}/> Edit existing role</label>
  </div>
  {mode==="create"?<label className="block text-sm">Role key (lowercase, 3–40 characters)<input maxLength={40} pattern="[a-z][a-z0-9-]{2,39}" placeholder="risk-analyst" value={key} onChange={e=>setKey(e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
  :<label className="block text-sm">Role<select value={selected} onChange={e=>setSelected(e.target.value)} className="mt-1 w-full rounded border p-2">{available.map(role=><option key={role.key} value={role.key}>{role.key} ({role.memberCount} members)</option>)}</select></label>}
  <fieldset className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"><legend className="px-2 text-sm font-semibold">Permissions</legend>
   {permissions.map(permission=><label key={permission.key} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={grants.includes(permission.key)} onChange={e=>flip(permission.key,e.target.checked)}/><span><strong className="block break-all">{permission.key}</strong><span className="text-xs text-slate-600">{permission.description}</span></span></label>)}
  </fieldset>
  <button disabled={busy||!(mode==="create"?key.trim():selected)} onClick={save} type="button" className="rounded bg-[#14253D] px-4 py-2 text-white disabled:opacity-50">{busy?"Saving…":mode==="create"?"Create role":"Save permissions"}</button>
  {message&&<p role="status" className="text-sm text-emerald-800">{message}</p>}
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {reauth&&<Link href="/login" className="text-sm text-violet-700 underline">Sign in again</Link>}
 </section>;
}
