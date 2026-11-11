"use client";
import {useRouter} from "next/navigation";
import {useState} from "react";
export function BotStrategyAdminControls({strategyId,status}:{strategyId:string;status:string}){
 const router=useRouter();
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const choices=status==="ONBOARDING"?["MONITORING","SHUTTING_DOWN"]:
  status==="MONITORING"?["TRADING","SHUTTING_DOWN"]:status==="TRADING"?["SHUTTING_DOWN"]:[];
 async function change(next:string){
  if(!window.confirm(next==="SHUTTING_DOWN"?
   "Stop new allocations and trades and start graceful pooled deallocation for all investors?":
   "Approve strategy transition to "+next+"?"))return;
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/admin/bot-strategies/"+strategyId+"/lifecycle",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:next})
   });
   const payload=await r.json();
   if(!r.ok)throw Error(payload.error??"Transition failed");
   router.refresh();
  }catch(err){setError(err instanceof Error?err.message:"Transition failed")}finally{setBusy(false)}
 }
 return <div className="flex flex-wrap items-center gap-3">
  {choices.map(next=><button key={next} disabled={busy} onClick={()=>{void change(next)}}
    className="rounded-lg border bg-white px-3 py-2 text-sm font-medium disabled:opacity-50">
    {next==="SHUTTING_DOWN"?"Begin graceful shutdown":"Approve "+next.toLowerCase()}</button>)}
  {error&&<span role="alert" className="text-sm text-red-700">{error}</span>}
 </div>;
}
