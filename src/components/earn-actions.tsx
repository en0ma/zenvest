"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
type Strategy = {id:string;name:string;description:string;min:string;max:string;capacity:string};
type Position = {id:string;strategyId:string;principal:string;status:string;created:string;pending:boolean};
type Operation = {id:string;positionId:string;type:string;amount:string;status:string;created:string;completed:string|null};
const money=(raw:string)=> (Number(raw)/1e6).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:6})+" USDC";
export function EarnActions({available,positions,operations,strategies}:{available:string;positions:Position[];operations:Operation[];strategies:Strategy[]}){
 const router=useRouter();
 const [amount,setAmount]=useState("");
 const [strategyId,setStrategyId]=useState("");
 const [allocationPositionId,setAllocationPositionId]=useState("");
 const strategy=strategies.find(x=>x.id===strategyId);
 const [selected,setSelected]=useState<Position|null>(null);
 const [reduceAmount,setReduceAmount]=useState("");
 const [working,setWorking]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 async function submit(path:string,payload:Record<string,string>){
  setError("");setNotice("");setWorking(true);
  try{
   const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,requestId:crypto.randomUUID()})});
   const data=await response.json();
   if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"Request could not be created");
   setNotice("Request recorded. Capital changes only after independently verified custody movement.");
   setAmount("");setSelected(null);setReduceAmount("");setAllocationPositionId("");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Request failed");}
  finally{setWorking(false);}
 }
 const valid=(s:string)=>/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(s)&&Number(s)>0;
 const heading="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]";
 const cell="whitespace-nowrap px-5 py-4 text-sm text-[#334155]";
 return <div className="space-y-8">
  <section className="rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
   <h2 className="text-xl font-semibold text-[#11263E]">Open allocation</h2>
   <p className="mt-2 text-sm text-[#64748B]">Choose how much of your available USDC to commit to a new position. Funds are reserved immediately; allocation completes only after verified strategy funding.</p>
   <p className="mt-5 text-sm text-[#64748B]">Available to allocate or withdraw: <strong className="text-[#11263E]">{money(available)}</strong></p>
   <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();if(valid(amount)&&strategy)void submit("/api/earn/allocations",{amount,strategyId,...(allocationPositionId?{positionId:allocationPositionId}:{})});}}>
    <label className="flex min-w-[220px] flex-col gap-2 text-sm font-semibold text-[#334155]">Strategy<select required aria-label="Choose strategy" value={strategyId} onChange={e=>{setStrategyId(e.target.value);setAmount("");setAllocationPositionId("");}} className="rounded-xl border border-[#CBD5E1] px-4 py-3 font-normal"><option value="">Select a strategy</option>{strategies.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label className="flex min-w-[220px] flex-col gap-2 text-sm font-semibold text-[#334155]">Amount (USDC)<input aria-label="Allocation amount in USDC" required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="rounded-xl border border-[#CBD5E1] px-4 py-3 font-normal"/></label>
    <label className="flex min-w-[220px] flex-col gap-2 text-sm font-semibold text-[#334155]">Position<select aria-label="Existing position or new position" value={allocationPositionId} onChange={e=>setAllocationPositionId(e.target.value)} className="rounded-xl border border-[#CBD5E1] px-4 py-3 font-normal"><option value="">Open new position</option>{positions.filter(p=>p.status==="OPEN"&&p.strategyId===strategyId).map(p=><option key={p.id} value={p.id}>{p.id.slice(0,13)}… ({money(p.principal)})</option>)}</select></label>
    <button disabled={working||!strategy||!valid(amount)||Number(amount)>Number(available)/1e6||Number(amount)<Number(strategy.min)/1e6||Number(amount)>Math.min(Number(strategy.max)/1e6,Number(strategy.capacity)/1e6)} className="rounded-xl bg-[#635BFF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Request allocation</button>
   </form>
   {strategy?<div className="mt-4 rounded-xl bg-[#F8FAFD] p-4 text-sm text-[#425466]"><p>{strategy.description}</p><p className="mt-2">Minimum: {money(strategy.min)} · Maximum: {money(strategy.max)} · Available capacity: {money(strategy.capacity)}</p></div>:<p className="mt-4 text-xs text-[#64748B]">Choose an active public strategy to see its allocation limits.</p>}
  </section>
  <section className="rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
   <h2 className="text-xl font-semibold text-[#11263E]">Active allocations</h2>
   <p className="mt-2 text-sm text-[#64748B]">Reduce part of a position or request its full closure. Returned USDC is not spendable until verified back in master custody.</p>
   {positions.filter(p=>p.status==="OPEN"||p.status==="CLOSING").length===0?<p className="mt-6 text-sm text-[#64748B]">No positions yet.</p>:
    <div role="region" aria-label="Active allocations table" tabIndex={0} className="mt-5 overflow-x-auto rounded-xl border border-[#E7EDF4]">
     <table className="w-full min-w-[800px]"><thead className="bg-[#F8FAFC]"><tr>{["Position ID","Allocated","Status","Created","Action"].map(h=><th key={h} className={heading}>{h}</th>)}</tr></thead>
     <tbody className="divide-y divide-[#EDF0F5]">{positions.filter(p=>p.status==="ACTIVE"||p.status==="PENDING").map(p=><tr key={p.id}>
      <td className={cell+" font-mono text-xs"}>{p.id}</td><td className={cell}>{money(p.principal)}</td><td className={cell}>{p.status}{p.pending?" · reduction pending":""}</td><td className={cell}>{p.created}</td>
      <td className={cell}><button type="button" disabled={working||p.status!=="OPEN"||p.pending||BigInt(p.principal)<=0n} onClick={()=>{setSelected(p);setReduceAmount("");setError("");}} className="rounded-lg border border-[#635BFF] px-3 py-2 font-semibold text-[#635BFF] disabled:opacity-40">Deallocate</button> <button type="button" disabled={working||p.status!=="OPEN"} onClick={()=>void submit("/api/earn/positions/close",{positionId:p.id})} className="ml-2 rounded-lg border px-3 py-2 font-semibold disabled:opacity-40">Close position</button></td>
     </tr>)}</tbody></table>
    </div>}
  </section>
  <section className="rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
   <h2 className="text-xl font-semibold text-[#11263E]">Position history</h2>
   {positions.filter(p=>p.status==="CLOSED").map(p=><p key={p.id} className="border-b py-3 text-sm text-[#64748B]">{p.id} · Closed · {p.created}</p>)}
   {!positions.some(p=>p.status==="CLOSED")&&<p className="mt-3 text-sm text-[#64748B]">No closed positions</p>}
  </section>
  <section className="rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
   <h2 className="text-xl font-semibold text-[#11263E]">Allocations and deallocations</h2>
   <p className="mt-2 text-sm text-[#64748B]">All position requests, including the allocation ID associated with each reduction.</p>
   {operations.length===0?<p className="mt-5 text-sm text-[#64748B]">No allocation requests yet.</p>:
    <div role="region" aria-label="Allocations and deallocations table" tabIndex={0} className="mt-5 overflow-x-auto rounded-xl border border-[#E7EDF4]">
     <table className="w-full min-w-[1050px]"><thead className="bg-[#F8FAFC]"><tr>{["Requested","Type","Amount","Status","Allocation ID","Operation ID","Completed"].map(h=><th key={h} className={heading}>{h}</th>)}</tr></thead>
     <tbody className="divide-y divide-[#EDF0F5]">{operations.map(o=><tr key={o.id}>
      <td className={cell}>{o.created}</td><td className={cell}>{o.type==="ALLOCATE"?"Allocate":"Deallocate"}</td>
      <td className={cell+" font-semibold"}>{money(o.amount)}</td><td className={cell}>{o.status}</td>
      <td className={cell+" font-mono text-xs"}>{o.positionId}</td><td className={cell+" font-mono text-xs"}>{o.id}</td><td className={cell}>{o.completed??"—"}</td>
     </tr>)}</tbody></table>
    </div>}
  </section>
  {notice&&<p role="status" className="rounded-xl bg-[#ECF7F1] px-4 py-3 text-sm text-[#317054]">{notice}</p>}
  {error&&<p role="alert" className="rounded-xl bg-[#FFF0F0] px-4 py-3 text-sm text-[#9C2F2F]">{error}</p>}
  {selected&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A2540]/60 p-4" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
   <div role="dialog" aria-modal="true" aria-labelledby="deallocate-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
    <h2 id="deallocate-title" className="text-xl font-semibold text-[#11263E]">Deallocate position</h2>
    <p className="mt-2 break-all text-xs text-[#64748B]">Allocation ID: {selected.id}</p>
    <p className="mt-3 text-sm text-[#64748B]">Current allocated balance: {money(selected.principal)}. A deallocation never closes the position. Use the separate Close Position action to close it.</p>
    <form className="mt-5 space-y-4" onSubmit={e=>{e.preventDefault();if(valid(reduceAmount))void submit("/api/earn/deallocations",{positionId:selected.id,amount:reduceAmount});}}>
     <label className="flex flex-col gap-2 text-sm font-semibold">Amount to deallocate (USDC)<input autoFocus required inputMode="decimal" value={reduceAmount} onChange={e=>setReduceAmount(e.target.value)} className="rounded-xl border border-[#CBD5E1] px-4 py-3 font-normal" placeholder="0.00"/></label>
     <button type="button" onClick={()=>setReduceAmount((BigInt(selected.principal)/1000000n).toString()+"."+(BigInt(selected.principal)%1000000n).toString().padStart(6,"0"))} className="text-sm font-semibold text-[#635BFF]">Use full position amount</button>
     <div className="flex justify-end gap-3"><button type="button" onClick={()=>setSelected(null)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={working||!valid(reduceAmount)||Number(reduceAmount)>Number(selected.principal)/1e6} className="rounded-lg bg-[#635BFF] px-4 py-2 font-semibold text-white disabled:opacity-40">Request deallocation</button></div>
    </form>
   </div>
  </div>}
 </div>;
}
