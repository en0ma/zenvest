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
 const [side,setSide]=useState<"ALLOCATE"|"DEALLOCATE">("ALLOCATE");
 const strategy=strategies.find(x=>x.id===strategyId);
 const existingPosition=positions.find(p=>p.strategyId===strategyId&&(p.status==="OPEN"||p.status==="CLOSING"));
 const deallocationBalance=existingPosition?.status==="OPEN"?BigInt(existingPosition.principal):0n;
 const availableBalance=side==="ALLOCATE"?BigInt(available):deallocationBalance;
 const amountIsValid=/^(0|[1-9]\\d*)(\\.\\d{1,6})?$/.test(amount);
 const amountMicros=amountIsValid?(()=>{const [w,f=""]=amount.split(".");return BigInt(w)*1000000n+BigInt(f.padEnd(6,"0"));})():0n;
 const canConfirm=!!strategy&&!working&&amountMicros>0n&&amountMicros<=availableBalance&&(
  side==="ALLOCATE"?(existingPosition?.status!=="CLOSING"&&amountMicros>=BigInt(strategy.min)&&amountMicros<=BigInt(strategy.max)&&amountMicros<=BigInt(strategy.capacity)):
  (existingPosition?.status==="OPEN"&&!existingPosition.pending));
 const [selected,setSelected]=useState<Position|null>(null);
 const [reduceAmount,setReduceAmount]=useState("");
 const [working,setWorking]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [historyPage,setHistoryPage]=useState(1);
 const [allocationsPage,setAllocationsPage]=useState(1);
 const [deallocationsPage,setDeallocationsPage]=useState(1);
 const PAGE_SIZE=10;
 const closedPositions=positions.filter(p=>p.status==="CLOSED");
 const activePositions=positions.filter(p=>p.status==="OPEN"||p.status==="CLOSING");
 const historyPages=Math.max(1,Math.ceil(closedPositions.length/PAGE_SIZE));
 const allocations=operations.filter(o=>o.type==="ALLOCATE");
 const deallocations=operations.filter(o=>o.type==="DEALLOCATE");
 const allocationPages=Math.max(1,Math.ceil(allocations.length/PAGE_SIZE));
 const deallocationPages=Math.max(1,Math.ceil(deallocations.length/PAGE_SIZE));
 const shownHistoryPage=Math.min(historyPage,historyPages);
 const shownAllocationsPage=Math.min(allocationsPage,allocationPages);
 const shownDeallocationsPage=Math.min(deallocationsPage,deallocationPages);
 const pagedHistory=closedPositions.slice((shownHistoryPage-1)*PAGE_SIZE,shownHistoryPage*PAGE_SIZE);
 const pagedAllocations=allocations.slice((shownAllocationsPage-1)*PAGE_SIZE,shownAllocationsPage*PAGE_SIZE);
 const pagedDeallocations=deallocations.slice((shownDeallocationsPage-1)*PAGE_SIZE,shownDeallocationsPage*PAGE_SIZE);
 async function submit(path:string,payload:Record<string,string>){
  setError("");setNotice("");setWorking(true);
  try{
   const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,requestId:crypto.randomUUID()})});
   const data=await response.json();
   if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"Request could not be created");
   setNotice("Request recorded. Capital changes only after independently verified custody movement.");
   setAmount("");setSelected(null);setReduceAmount("");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Request failed");}
  finally{setWorking(false);}
 }
 const valid=(s:string)=>/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(s)&&Number(s)>0;
 const heading="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]";
 const cell="whitespace-nowrap px-5 py-4 text-sm text-[#334155]";
 const pageControls=(label:string,page:number,pages:number,setPage:(page:number)=>void)=> <nav aria-label={label+" pagination"} className="mt-4 flex items-center justify-between gap-3 text-sm"><span className="text-[#64748B]">Page {page} of {pages}</span><div className="flex gap-2"><button type="button" onClick={()=>setPage(Math.max(1,page-1))} disabled={page<=1} className="rounded-lg border border-[#DEE5EE] px-3 py-2 font-medium disabled:opacity-40">Previous</button><button type="button" onClick={()=>setPage(Math.min(pages,page+1))} disabled={page>=pages} className="rounded-lg border border-[#DEE5EE] px-3 py-2 font-medium disabled:opacity-40">Next</button></div></nav>;
 return <div className="space-y-8">
  <section className="rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
   <h2 className="text-xl font-semibold text-[#11263E]">Earn market</h2>
   <label className="mt-5 block text-sm font-semibold text-[#334155]">Market (strategy)
    <select aria-label="Select market strategy" value={strategyId} onChange={e=>{setStrategyId(e.target.value);setAmount("");setSide("ALLOCATE");}} className="mt-2 w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 font-normal">
     <option value="">Select a market</option>{strategies.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
    </select>
   </label>
   <div className="mt-5 min-h-[130px] rounded-xl border border-[#E7EDF4] bg-[#FAFBFD] px-4 py-5">
    <h3 className="text-sm font-semibold text-[#334155]">Strategy performance</h3>
    <p className="mt-3 text-sm text-[#64748B]">A verified historical strategy performance chart is not available yet. No simulated prices or returns are shown.</p>
   </div>
   <div role="group" aria-label="Position action" className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-[#F1F5F9] p-1">
    <button type="button" aria-pressed={side==="ALLOCATE"} onClick={()=>{setSide("ALLOCATE");setAmount("");}} className={"rounded-lg px-4 py-3 text-sm font-semibold transition "+(side==="ALLOCATE"?"bg-emerald-600 text-white":"text-[#64748B]")}>Allocate</button>
    <button type="button" aria-pressed={side==="DEALLOCATE"} onClick={()=>{setSide("DEALLOCATE");setAmount("");}} className={"rounded-lg px-4 py-3 text-sm font-semibold transition "+(side==="DEALLOCATE"?"bg-red-600 text-white":"text-[#64748B]")}>Deallocate</button>
   </div>
   {strategy&&<p className="mt-3 text-xs text-[#64748B]">{existingPosition?.status==="OPEN"?"Existing open position: "+existingPosition.id:existingPosition?.status==="CLOSING"?"Position closing; allocations and reductions are blocked until closure is verified.":"No open position in this market; allocating creates one."}</p>}
   <form className="mt-4 space-y-4" onSubmit={e=>{e.preventDefault();if(!canConfirm||!strategy)return;
    if(side==="ALLOCATE")void submit("/api/earn/allocations",{amount,strategyId:strategy.id,...(existingPosition?{positionId:existingPosition.id}:{})});
    else if(existingPosition)void submit("/api/earn/deallocations",{amount,positionId:existingPosition.id});
   }}>
    <label className="block text-sm font-semibold text-[#334155]">
     <span className="flex items-baseline justify-between gap-3"><span>Amount</span><span className="text-xs font-normal text-[#64748B]">Balance: {money(availableBalance.toString())}</span></span>
     <input aria-label={side==="ALLOCATE"?"Allocation amount in USDC":"Deallocation amount in USDC"} required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="mt-2 w-full rounded-xl border border-[#CBD5E1] px-4 py-3 font-normal"/>
    </label>
    <button type="submit" disabled={!canConfirm} className="w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-[#11263E] disabled:cursor-not-allowed disabled:opacity-40">Confirm {side==="ALLOCATE"?"allocation":"deallocation"}</button>
   </form>
   <p className="mt-3 text-xs leading-5 text-[#64748B]">Confirmation creates a pending request, not a completed custody movement. Deallocation is credited only after authenticated return of funds.</p>
  </section>
  <section className="rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
   <h2 className="text-xl font-semibold text-[#11263E]">Positions</h2>
   <p className="mt-2 text-sm text-[#64748B]">Reduce part of a position or request its full closure. Returned USDC is not spendable until verified back in master custody.</p>
   {activePositions.length===0?<p className="mt-6 text-sm text-[#64748B]">No positions yet.</p>:
    <div role="region" aria-label="Positions table" tabIndex={0} className="mt-5 overflow-x-auto rounded-xl border border-[#E7EDF4]">
     <table className="w-full min-w-[800px]"><thead className="bg-[#F8FAFC]"><tr>{["Position ID","Allocated","Status","Created","Action"].map(h=><th key={h} className={heading}>{h}</th>)}</tr></thead>
     <tbody className="divide-y divide-[#EDF0F5]">{activePositions.map(p=><tr key={p.id}>
      <td className={cell+" font-mono text-xs"}>{p.id}</td><td className={cell}>{money(p.principal)}</td><td className={cell}>{p.status}{p.pending?" · reduction pending":""}</td><td className={cell}>{p.created}</td>
      <td className={cell}><button type="button" disabled={working||p.status!=="OPEN"||p.pending||BigInt(p.principal)<=0n} onClick={()=>{setSelected(p);setReduceAmount("");setError("");}} className="rounded-lg border border-[#635BFF] px-3 py-2 font-semibold text-[#635BFF] disabled:opacity-40">Deallocate</button> <button type="button" disabled={working||p.status!=="OPEN"} onClick={()=>void submit("/api/earn/positions/close",{positionId:p.id})} className="ml-2 rounded-lg border px-3 py-2 font-semibold disabled:opacity-40">Close position</button></td>
     </tr>)}</tbody></table>
    </div>}
   <div className="mt-8 border-t border-[#EDF0F5] pt-7">
   <h2 className="text-xl font-semibold text-[#11263E]">Position history</h2>
   <div role="region" aria-label="Scrollable position history table" tabIndex={0} className="mt-5 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-[#E7EDF4]">
      <table className="w-full min-w-[720px] border-collapse text-left"><thead className="bg-[#F8FAFC]"><tr>{["Position ID","Strategy","Status","Created","Final allocated"].map(h=><th key={h} className={heading}>{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-[#EDF0F5]">{pagedHistory.map(p=><tr key={p.id}><td className={cell+" font-mono text-xs"}>{p.id}</td><td className={cell}>{strategies.find(x=>x.id===p.strategyId)?.name??p.strategyId}</td><td className={cell}>Closed</td><td className={cell}>{p.created}</td><td className={cell}>{money(p.principal)}</td></tr>)}{closedPositions.length===0&&<tr><td colSpan={5} className="px-5 py-8 text-sm text-[#64748B]">No closed positions yet.</td></tr>}</tbody></table>
     </div>{pageControls("Position history",shownHistoryPage,historyPages,setHistoryPage)}
   </div>
  </section>
  <section className="rounded-[24px] border border-[#E3E8EE] bg-white p-6 sm:p-8">
   <h2 className="text-xl font-semibold text-[#11263E]">Deallocate</h2>
   <p className="mt-2 text-sm text-[#64748B]">To reduce a position, select Deallocate in the Positions table above. Funds become available only after verified return to custody.</p>
   <div className="mt-8 border-t border-[#EDF0F5] pt-7">
    <h3 className="text-lg font-semibold text-[#11263E]">Deallocation history</h3>
    <div role="region" aria-label="Deallocation history scrollable table" tabIndex={0} className="mt-4 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-[#E7EDF4]">
     <table className="w-full min-w-[930px] border-collapse text-left">
      <thead className="bg-[#F8FAFC]"><tr>{["Requested","Amount","Status","Position ID","Operation ID","Completed"].map(h=><th key={h} scope="col" className={heading}>{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-[#EDF0F5]">{pagedDeallocations.map(o=><tr key={o.id}>
       <td className={cell}>{o.created}</td><td className={cell+" font-semibold"}>{money(o.amount)}</td>
       <td className={cell}>{o.status}</td><td className={cell+" font-mono text-xs"}>{o.positionId}</td>
       <td className={cell+" font-mono text-xs"}>{o.id}</td><td className={cell}>{o.completed??"—"}</td>
      </tr>)}{deallocations.length===0&&<tr><td colSpan={6} className="px-5 py-8 text-sm text-[#64748B]">No deallocation requests yet.</td></tr>}</tbody>
     </table>
    </div>
    {pageControls("Deallocation history",shownDeallocationsPage,deallocationPages,setDeallocationsPage)}
   </div>
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
