"use client";
import {useRouter} from "next/navigation";
import {useState} from "react";
export function PositionCapitalActions({strategyId,positionId,available,allocated,reserved,min,max,capacity,status}:{strategyId:string;positionId?:string;available:string;allocated?:string;reserved?:string;min:string;max:string;capacity:string;status?:string}){
 const router=useRouter();const [amount,setAmount]=useState("");const [kind,setKind]=useState<"ALLOCATE"|"DEALLOCATE">("ALLOCATE");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 const valid=/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(amount);const parts=amount.split(".");const micros=valid?BigInt(parts[0])*1000000n+BigInt((parts[1]??"").padEnd(6,"0")):0n;
 const balance=kind==="ALLOCATE"?BigInt(available):BigInt(allocated??"0")-BigInt(reserved??"0");
 const validAmount=micros>0n&&micros<=balance&&(kind==="DEALLOCATE"||micros>=BigInt(min)&&micros<=BigInt(max)&&micros<=BigInt(capacity));
 async function submit(type:"ALLOCATE"|"DEALLOCATE"|"CLOSE"){
  const path=type==="CLOSE"?"/api/earn/positions/close":type==="ALLOCATE"?"/api/earn/allocations":"/api/earn/deallocations";
  const payload=type==="CLOSE"?{positionId}:{amount,...(type==="ALLOCATE"?{strategyId,...(positionId?{positionId}:{})}:{positionId})};
  setBusy(true);setMessage("");try{const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw Error(result.error??"Request failed");setMessage("Request recorded. Capital settles through the verified worker flow.");setAmount("");router.refresh();if(!positionId&&result.positionId)router.push("/earn/positions/"+result.positionId);}catch(e){setMessage(e instanceof Error?e.message:"Request failed");}finally{setBusy(false);}
 }
 return <section className="rounded-2xl border border-[#E3E8EE] bg-white p-5 sm:p-7">
  <h2 className="text-lg font-semibold text-[#14253D]">{positionId?"Manage position":"Open a new position"}</h2>
  {(!status||status==="OPEN")?<><div className="mt-5 flex gap-2"><button onClick={()=>{setKind("ALLOCATE");setAmount("");}} type="button" className={"rounded-lg px-4 py-2 text-sm font-semibold "+(kind==="ALLOCATE"?"bg-emerald-600 text-white":"border text-[#334155]")}>Allocate</button>{positionId&&<button onClick={()=>{setKind("DEALLOCATE");setAmount("");}} type="button" className={"rounded-lg px-4 py-2 text-sm font-semibold "+(kind==="DEALLOCATE"?"bg-rose-600 text-white":"border text-[#334155]")}>Deallocate</button>}</div>
   <form className="mt-4 space-y-3" onSubmit={e=>{e.preventDefault();if(validAmount&&!busy)void submit(kind);}}>
    <label className="block text-sm font-semibold text-[#334155]">Amount (USDC)<input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="mt-2 w-full rounded-xl border border-[#CBD5E1] p-3"/></label>
    <p className="text-xs text-[#64748B]">Available: {(Number(balance>0n?balance:0n)/1e6).toFixed(2)} USDC</p><button disabled={!validAmount||busy} className="rounded-xl bg-[#14253D] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy?"Submitting…":kind==="ALLOCATE"?"Request allocation":"Request deallocation"}</button>
   </form>
   {positionId&&<div className="mt-6 border-t pt-5"><button type="button" disabled={busy} onClick={()=>{if(window.confirm("Request closure of this position?"))void submit("CLOSE");}} className="text-sm font-semibold text-rose-700 disabled:opacity-50">Close this position</button></div>}
  </>:<p className="mt-4 text-sm text-[#64748B]">This position is {status?.toLowerCase()}. Capital changes are unavailable.</p>}
  {message&&<p role="status" className="mt-4 text-sm text-[#475569]">{message}</p>}
 </section>;
}
