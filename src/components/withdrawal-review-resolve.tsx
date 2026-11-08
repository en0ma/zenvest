"use client";
import {useRouter} from "next/navigation";
import {useState} from "react";

export function WithdrawalReviewResolve({id}:{id:string}){
 const router=useRouter();
 const [loading,setLoading]=useState(false);
 const [message,setMessage]=useState<string|null>(null);
 async function resolve(){
  setLoading(true);setMessage(null);
  try{
   const response=await fetch(`/api/admin/withdrawals/${encodeURIComponent(id)}/resolve-review`,{
    method:"POST",cache:"no-store",
   });
   const payload=await response.json() as {outcome?:string;reason?:string;error?:string};
   setMessage(response.ok?(payload.outcome==="settled"?
    "Verified provider outcome applied.":"No verified terminal outcome; funds remain reserved ("+(payload.reason??"unknown")+")."):
    (payload.error??"Unable to reconcile provider status"));
   router.refresh();
  }catch{setMessage("Provider check unavailable; funds remain reserved.");}
  finally{setLoading(false);}
 }
 return <div className="space-y-1">
  <button type="button" disabled={loading} onClick={resolve}
   className="rounded-lg border border-[#345e83] px-3 py-2 text-sm font-medium disabled:opacity-50">
   {loading?"Checking Blockradar...":"Resolve review"}
  </button>
  {message&&<p role="status" className="max-w-xs text-xs text-[#425466]">{message}</p>}
 </div>;
}
