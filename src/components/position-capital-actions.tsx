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
 return <section className="rounded-[28px] border border-[#E3E8EE] bg-white px-5 py-7 sm:px-8 sm:py-9">
  <h2 className="mb-6 text-xl font-semibold text-[#14253D]">{positionId?"Manage position":"Open a new position"}</h2>
  {(!status||status==="OPEN")?<><div className="grid grid-cols-2 gap-3 sm:gap-4"><button onClick={()=>{setKind("ALLOCATE");setAmount("");}} type="button" className={"min-h-[60px] rounded-2xl border-2 px-4 py-4 text-lg font-bold "+(kind==="ALLOCATE"?"border-[#07966D] bg-[#07966D] text-white":"border-[#97A3B7] bg-white text-[#4B5568]")}>Allocate</button>{positionId&&<button onClick={()=>{setKind("DEALLOCATE");setAmount("");}} type="button" className={"rounded-lg px-4 py-2 text-sm font-semibold "+(kind==="DEALLOCATE"?"border-[#07966D] bg-[#07966D] text-white":"border text-[#334155]")}>Deallocate</button>}</div>
   <form className="mt-7 space-y-5" onSubmit={e=>{e.preventDefault();if(validAmount&&!busy)void submit(kind);}}>
    <label className="block text-lg font-bold text-[#334155]">Amount<input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="mt-3 w-full rounded-2xl border border-[#CBD5E1] px-5 py-4 text-xl"/></label>
    <p className="text-sm text-[#778297]">Balance: {(Number(balance>0n?balance:0n)/1e6).toFixed(2)} USDC</p><button disabled={!validAmount||busy} className="w-full rounded-2xl bg-[#F5C64C] px-5 py-5 text-lg font-bold text-[#263344] disabled:bg-[#FFE6A8] disabled:text-[#A9A49C]">{busy?"Submitting…":"Confirm"}</button>
   </form>
   {positionId&&<div className="mt-6 border-t pt-5"><button type="button" disabled={busy} onClick={()=>{if(window.confirm("Request closure of this position?"))void submit("CLOSE");}} className="text-sm font-semibold text-rose-700 disabled:opacity-50">Close this position</button></div>}
  </>:<p className="mt-4 text-sm text-[#64748B]">This position is {status?.toLowerCase()}. Capital changes are unavailable.</p>}
  {message&&<p role="status" className="mt-4 text-sm text-[#475569]">{message}</p>}
 </section>;
}
