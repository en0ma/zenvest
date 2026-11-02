"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
export default function DepositReplay({id}:{id:string}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[reauth,setReauth]=useState(false);
 async function replay(){
  if(busy||!window.confirm("Ask Blockradar to replay the signed webhook for this approved deposit? Only signed, verified provider evidence may credit the investor."))return;
  setBusy(true);setMessage("");setReauth(false);
  try{
   const response=await fetch("/api/admin/actions/"+encodeURIComponent(id)+"/reconcile",{method:"POST"});
   const data=await response.json().catch(()=>({}));
   if(!response.ok){if(response.status===401&&data.code==="STAFF_REAUTH_REQUIRED")setReauth(true);throw new Error(typeof data.error==="string"?data.error:"Replay unavailable; do not retry until reviewed");}
   setMessage("Signed webhook replay requested; awaiting verified settlement.");
   router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:"Replay failed")}finally{setBusy(false)}
 }
 return <div className="space-y-2"><button type="button" disabled={busy} onClick={replay} className="rounded-md border border-amber-600 px-3 py-2 text-xs text-amber-900 disabled:opacity-40">{busy?"Submitting…":"Reconcile deposit"}</button>{message&&<p role="status" className="max-w-52 text-xs">{message}</p>}{reauth&&<Link href="/login" className="text-xs text-violet-700 underline">Sign in again</Link>}</div>;
}
