"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
export default function WithdrawalDispatch({id}:{id:string}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[reauth,setReauth]=useState(false);
 async function execute(){
  if(busy||!window.confirm("Submit this independently approved withdrawal to Blockradar? This may move real funds and cannot be reversed. The provider webhook will determine settlement."))return;
  setBusy(true);setMessage("");setReauth(false);
  try{
   const res=await fetch("/api/admin/actions/"+encodeURIComponent(id)+"/execute",{method:"POST"});
   const body=await res.json().catch(()=>({}));
   if(!res.ok){if(res.status===401&&body.code==="STAFF_REAUTH_REQUIRED")setReauth(true);throw Error(typeof body.error==="string"?body.error:typeof body.status==="string"?body.status:"Dispatch unavailable");}
   setMessage(body.execution==="PROVIDER_ACCEPTED_AWAITING_WEBHOOK"?"Provider accepted; awaiting signed settlement confirmation.":"Dispatch status unknown. Do not retry; investigate with operations.");
   router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:"Dispatch failed")}finally{setBusy(false)}
 }
 return <div className="space-y-2"><button disabled={busy} onClick={execute} className="rounded-md border border-amber-600 px-3 py-2 text-xs text-amber-900 disabled:opacity-40">{busy?"Submitting…":"Dispatch withdrawal"}</button>{message&&<p role="status" className="max-w-52 text-xs">{message}</p>}{reauth&&<Link href="/login" className="text-xs text-violet-700 underline">Sign in again</Link>}</div>;
}
