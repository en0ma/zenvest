"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
/** Admin withdrawal uses the same currently mocked provider response as investor deallocation. */
export default function KalshiWithdrawalControl({id}:{id:string}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[reauth,setReauth]=useState(false);
 async function run(){
  if(busy||!window.confirm("Submit this approved Kalshi → Master withdrawal? The currently configured Kalshi adapter responds with mock HTTP 200, so the transfer will show Processing until verified settlement."))return;
  setBusy(true);setMessage("");setReauth(false);
  try{
   const response=await fetch("/api/admin/actions/"+encodeURIComponent(id)+"/kalshi-withdrawal",{method:"POST"});
   const body=await response.json().catch(()=>({}));
   if(!response.ok){
    if(response.status===401&&body.code==="STAFF_REAUTH_REQUIRED")setReauth(true);
    throw Error(typeof body.error==="string"?body.error:body.status==="REVIEW"?"Withdrawal requires review":"Withdrawal unavailable");
   }
   setMessage("Kalshi withdrawal accepted for processing. Awaiting verified receipt before treasury settlement.");
   router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:"Withdrawal failed")}finally{setBusy(false)}
 }
 return <div className="space-y-2"><button type="button" disabled={busy} onClick={run} className="rounded-md border border-sky-600 px-3 py-2 text-xs text-sky-900 disabled:opacity-40">{busy?"Submitting…":"Withdraw from Kalshi"}</button>{message&&<p role="status" className="max-w-56 text-xs">{message}</p>}{reauth&&<Link href="/login" className="text-xs text-violet-700 underline">Sign in again</Link>}</div>;
}
