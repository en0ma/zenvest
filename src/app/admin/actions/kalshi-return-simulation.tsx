"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
/** Explicitly simulation-only; cannot send a real Kalshi withdrawal. */
export default function KalshiReturnSimulation({id}:{id:string}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[reauth,setReauth]=useState(false);
 async function run(){
  if(busy||!window.confirm("Simulate this approved K_BANK → M_BANK return using the existing Kalshi mock? NO real USDC will move and neither treasury balance will change."))return;
  setBusy(true);setMessage("");setReauth(false);
  try{
   const response=await fetch("/api/admin/actions/"+encodeURIComponent(id)+"/kalshi-simulate",{method:"POST"});
   const body=await response.json().catch(()=>({}));
   if(!response.ok){
    if(response.status===401&&body.code==="STAFF_REAUTH_REQUIRED")setReauth(true);
    throw Error(typeof body.error==="string"?body.error:body.status==="SIMULATION_REVIEW"?"Simulation outcome requires review":"Simulation unavailable");
   }
   setMessage("Simulated Kalshi acceptance recorded. No funds moved and K_BANK/M_BANK balances unchanged.");
   router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:"Simulation failed")}finally{setBusy(false)}
 }
 return <div className="space-y-2"><button type="button" disabled={busy} onClick={run} className="rounded-md border border-sky-600 px-3 py-2 text-xs text-sky-900 disabled:opacity-40">{busy?"Simulating…":"Simulate Kalshi return"}</button>{message&&<p role="status" className="max-w-56 text-xs">{message}</p>}{reauth&&<Link href="/login" className="text-xs text-violet-700 underline">Sign in again</Link>}</div>;
}
