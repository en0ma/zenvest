"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
type Settings={
 manager_percentage:string;platform_percentage:string;sandbox_fee_bps:number|null;
 admission_min_days:number|null;admission_min_fills:number|null;
 admission_max_drawdown_pct:string;total_capacity_usdc:string;
};
export function BotStrategySettings({strategyId,initial}:{strategyId:string;initial:Settings}){
 const router=useRouter();
 const [settings,setSettings]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const field=(key:keyof Settings,label:string,type:"number"|"text"="text")=><label className="text-xs text-slate-700">{label}
  <input type={type} min={type==="number"?0:undefined} value={settings[key]??""} onChange={e=>setSettings(p=>({...p,[key]:type==="number"?(e.target.value===""?null:Number(e.target.value)):e.target.value}))}
   className="mt-1 block w-full rounded border p-2 text-sm"/></label>;
 async function save(){
  setBusy(true);setError("");setMessage("");
  try{
   const r=await fetch("/api/admin/bot-strategies/"+strategyId+"/settings",{
    method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(settings)
   });
   const data=await r.json();
   if(!r.ok)throw Error(data.error??"Unable to save strategy settings");
   setMessage("Admin policy saved. Changes to percentages affect future activity only.");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to save")}finally{setBusy(false)}
 }
 return <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
  <h3 className="text-sm font-semibold">Admission, capacity and revenue configuration</h3>
  <div className="grid grid-cols-2 gap-3">
   {field("manager_percentage","Manager share of net profit (%)")}
   {field("platform_percentage","Zenvest share of net profit (%)")}
   {field("sandbox_fee_bps","Sandbox estimated fee (bps)","number")}
   {field("total_capacity_usdc","Strategy total capacity (USDC)")}
   {field("admission_min_days","Minimum sandbox days","number")}
   {field("admission_min_fills","Minimum sandbox fills","number")}
   {field("admission_max_drawdown_pct","Maximum sandbox drawdown (%)")}
  </div>
  <p className="text-xs text-amber-700">Percentages are stored and versioned but do not yet trigger manager payouts. Sandbox fees are estimates, not verified Kalshi charges.</p>
  <button disabled={busy} onClick={()=>void save()} className="rounded bg-[#14253D] px-4 py-2 text-sm text-white disabled:opacity-50">Save admin settings</button>
  {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
  {message&&<p role="status" className="text-xs text-emerald-700">{message}</p>}
 </div>;
}
