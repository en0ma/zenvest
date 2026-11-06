"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
type Props={id:string;canDecide:boolean};
export default function ReviewControls({id,canDecide}:Props){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[reauth,setReauth]=useState(false);
 async function decide(approve:boolean){
  if(!canDecide||busy)return;
  if(!window.confirm(approve?"Approve this request? This DOES NOT execute the financial operation.":"Reject this request?"))return;
  setBusy(true);setError("");setReauth(false);
  try{
   const response=await fetch("/api/admin/actions/"+encodeURIComponent(id)+"/decision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({approve})});
   if(!response.ok){const data=await response.json().catch(()=>({error:"Unable to decide"}));if(response.status===401&&data.code==="STAFF_REAUTH_REQUIRED")setReauth(true);throw new Error(data.error??"Request failed")}
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to complete review")}finally{setBusy(false)}
 }
 return <div className="flex flex-col gap-2"><div className="flex gap-2"><button type="button" disabled={!canDecide||busy} onClick={()=>decide(true)} className="rounded-md bg-[#14253D] px-3 py-2 text-xs text-white disabled:opacity-40">Approve</button><button type="button" disabled={!canDecide||busy} onClick={()=>decide(false)} className="rounded-md border px-3 py-2 text-xs disabled:opacity-40">Reject</button></div>{error&&<p role="alert" className="max-w-52 text-xs text-red-700">{error}</p>}{reauth&&<Link href="/login" className="text-xs text-violet-700 underline">Sign in again</Link>}</div>
}
