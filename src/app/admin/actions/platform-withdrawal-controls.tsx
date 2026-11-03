"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
/** Two independently confirmed steps: reserve platform treasury, then dispatch to provider. */
export default function PlatformWithdrawalControls({actionId,withdrawalId,status}:{actionId:string;withdrawalId?:string;status?:string}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[reauth,setReauth]=useState(false);
 async function perform(){
  if(busy)return;
  const dispatch=Boolean(withdrawalId);
  if(!window.confirm(dispatch?"Submit this reserved PLATFORM-FUNDED withdrawal to Blockradar? Real funds may move.":"Reserve platform-owned bank and fee funds for this approved master-wallet payout?"))return;
  setBusy(true);setMessage("");setReauth(false);
  try{
   const url=dispatch?"/api/admin/platform-withdrawals/"+encodeURIComponent(withdrawalId!)+"/dispatch":"/api/admin/actions/"+encodeURIComponent(actionId)+"/platform-withdrawal";
   const response=await fetch(url,{method:"POST"});
   const body=await response.json().catch(()=>({}));
   if(!response.ok){
    if(response.status===401&&body.code==="STAFF_REAUTH_REQUIRED")setReauth(true);
    throw new Error(typeof body.error==="string"?body.error:typeof body.status==="string"?body.status:"Operation failed; reconcile before retry");
   }
   setMessage(dispatch?"Provider response: "+String(body.execution??body.status)+". Await verified settlement.":"Platform funds reserved. Dispatch requires a separate confirmation.");
   router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:"Operation unavailable")}finally{setBusy(false)}
 }
 if(withdrawalId&&status!=="PENDING")return <span className="text-xs text-amber-800">Platform payout: {status} (no automatic retry)</span>;
 return <div className="space-y-2">
  <button type="button" disabled={busy} onClick={perform} className="rounded-md border border-amber-600 px-3 py-2 text-xs text-amber-950 disabled:opacity-40">{busy?"Submitting…":withdrawalId?"Dispatch reserved payout":"Reserve platform funds"}</button>
  {message&&<p role="status" className="max-w-48 text-xs">{message}</p>}
  {reauth&&<Link href="/login" className="text-xs text-violet-700 underline">Sign in again</Link>}
 </div>;
}
