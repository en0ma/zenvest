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
 const amountIsValid=/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(amount);
 const amountMicros=amountIsValid?(()=>{const [w,f=""]=amount.split(".");return BigInt(w)*1000000n+BigInt(f.padEnd(6,"0"));})():0n;
 const [selected,setSelected]=useState<Position|null>(null);
 const [reduceAmount,setReduceAmount]=useState("");
 const [working,setWorking]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const canConfirm=!!strategy&&!working&&amountMicros>0n&&amountMicros<=availableBalance&&(
  side==="ALLOCATE"?(existingPosition?.status!=="CLOSING"&&amountMicros>=BigInt(strategy.min)&&amountMicros<=BigInt(strategy.max)&&amountMicros<=BigInt(strategy.capacity)):
  (existingPosition?.status==="OPEN"&&!existingPosition.pending));

 const [activityTab,setActivityTab]=useState<"POSITIONS"|"TRADES">("POSITIONS");
 const [positionFilter,setPositionFilter]=useState<"OPEN"|"ALL">("OPEN");
 const [positionsPage,setPositionsPage]=useState(1);
 const PAGE_SIZE=10;
 const marketPositions=positions.filter(p=>p.strategyId===strategyId);
 const filteredPositions=marketPositions.filter(p=>positionFilter==="ALL"||p.status==="OPEN"||p.status==="CLOSING");
 const positionPages=Math.max(1,Math.ceil(filteredPositions.length/PAGE_SIZE));
 const shownPositionsPage=Math.min(positionsPage,positionPages);
 const pagedPositions=filteredPositions.slice((shownPositionsPage-1)*PAGE_SIZE,shownPositionsPage*PAGE_SIZE);
 const marketOperations=operations.filter(o=>marketPositions.some(p=>p.id===o.positionId));
 const tradePages=Math.max(1,Math.ceil(marketOperations.length/PAGE_SIZE));
 const [tradesPage,setTradesPage]=useState(1);
 const shownTradesPage=Math.min(tradesPage,tradePages);
 const pagedTrades=marketOperations.slice((shownTradesPage-1)*PAGE_SIZE,shownTradesPage*PAGE_SIZE);
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
    <select aria-label="Select market strategy" value={strategyId} onChange={e=>{setStrategyId(e.target.value);setAmount("");setSide("ALLOCATE");setPositionFilter("OPEN");setPositionsPage(1);setTradesPage(1);}} className="mt-2 w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 font-normal">
     <option value="">Select a market</option>{strategies.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
    </select>
   </label>
   <div className="mt-5 overflow-hidden rounded-xl border border-[#E7EDF4] bg-white">
    <div className="flex items-center justify-between gap-3 border-b border-[#EDF0F5] px-4 py-3">
     <h3 className="text-sm font-semibold text-[#334155]">Strategy performance</h3>
     <span className="text-xs text-[#64748B]">USDC · Historical</span>
    </div>
    <div role="img" aria-label="Empty historical strategy performance chart. No verified data is available yet." className="relative h-56 w-full sm:h-72">
     <svg viewBox="0 0 700 240" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
      {[40,85,130,175,220].map(y=><line key={y} x1="18" x2="680" y1={y} y2={y} stroke="#E8EDF4" strokeWidth="1"/>)}
      {[120,240,360,480,600].map(x=><line key={x} x1={x} x2={x} y1="16" y2="220" stroke="#F0F3F8" strokeWidth="1"/>)}
      <line x1="18" x2="680" y1="220" y2="220" stroke="#CBD5E1" strokeWidth="1.5"/>
      <line x1="18" x2="18" y1="16" y2="220" stroke="#CBD5E1" strokeWidth="1.5"/>
     </svg>
     <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
      <div className="rounded-lg bg-white/90 px-4 py-3 text-center shadow-sm ring-1 ring-[#E7EDF4]">
       <p className="text-sm font-medium text-[#475569]">No performance data yet</p>
       <p className="mt-1 text-xs text-[#94A3B8]">Verified strategy results will appear here</p>
      </div>
     </div>
    </div>
   </div>
   <div role="group" aria-label="Position action" className="mt-5 grid grid-cols-2 gap-3">
    <button type="button" aria-pressed={side==="ALLOCATE"} onClick={()=>{setSide("ALLOCATE");setAmount("");}} className={"rounded-lg px-4 py-3 text-sm font-semibold transition "+(side==="ALLOCATE"?"bg-emerald-600 text-white shadow-sm":"border border-[#DCE3EC] bg-[#F4F6FA] text-[#64748B] hover:bg-[#E9EEF5]")}>Allocate</button>
    <button type="button" aria-pressed={side==="DEALLOCATE"} onClick={()=>{setSide("DEALLOCATE");setAmount("");}} className={"rounded-lg px-4 py-3 text-sm font-semibold transition "+(side==="DEALLOCATE"?"bg-red-600 text-white shadow-sm":"border border-[#DCE3EC] bg-[#F4F6FA] text-[#64748B] hover:bg-[#E9EEF5]")}>Deallocate</button>
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
    <button type="submit" disabled={!canConfirm} className="w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-[#11263E] disabled:cursor-not-allowed disabled:opacity-40">Confirm</button>
   </form>
   <p className="mt-3 text-xs leading-5 text-[#64748B]">Confirmation creates a pending request, not a completed custody movement. Deallocation is credited only after authenticated return of funds.</p>
  </section>

  <section aria-label="Market positions and trades" className="overflow-hidden rounded-[24px] border border-[#E3E8EE] bg-white">
   <div role="tablist" aria-label="Market activity" className="flex items-center justify-between gap-3 border-b border-[#E3E8EE] px-5 sm:px-7">
    <div className="flex min-w-0 items-center gap-6">
    <button type="button" id="positions-tab" role="tab" aria-selected={activityTab==="POSITIONS"} aria-controls="market-activity-panel" onClick={()=>setActivityTab("POSITIONS")} className={"border-b-[3px] py-5 text-sm font-semibold transition-colors "+(activityTab==="POSITIONS"?"border-[#635BFF] text-[#11263E]":"border-transparent text-[#64748B] hover:text-[#11263E]")}>Positions <span className="ml-1 text-xs text-[#94A3B8]">({marketPositions.filter(p=>p.status!=="CLOSED").length})</span></button>
    <button type="button" id="trades-tab" role="tab" aria-selected={activityTab==="TRADES"} aria-controls="market-activity-panel" onClick={()=>setActivityTab("TRADES")} className={"border-b-[3px] py-5 text-sm font-semibold transition-colors "+(activityTab==="TRADES"?"border-[#635BFF] text-[#11263E]":"border-transparent text-[#64748B] hover:text-[#11263E]")}>Trades <span className="ml-1 text-xs text-[#94A3B8]">({marketOperations.length})</span></button>
    </div>
    {activityTab==="POSITIONS"&&<select aria-label="Filter market positions" value={positionFilter} onChange={e=>{setPositionFilter(e.target.value as "OPEN"|"ALL");setPositionsPage(1);}} className="w-auto max-w-[130px] shrink-0 rounded-lg border border-[#DCE3EC] bg-white px-2 py-1.5 text-xs text-[#334155]"><option value="OPEN">Open</option><option value="ALL">All</option></select>}
   </div>
   <div id="market-activity-panel" role="tabpanel" aria-labelledby={activityTab==="POSITIONS"?"positions-tab":"trades-tab"} className="p-5 sm:p-7">
    {activityTab==="POSITIONS"?<>
     <div className="mb-4"><h2 className="text-base font-semibold text-[#11263E]">Positions</h2><p className="mt-1 text-xs text-[#64748B]">{strategy?strategy.name:"Select a market to view positions"}</p></div>
     <div role="region" aria-label="Positions for selected market" tabIndex={0} className="max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-[#E7EDF4]">
      <table className="w-full min-w-[800px] border-collapse text-left">
       <thead className="bg-[#F8FAFC]"><tr>{["Position ID","Allocated","Status","Created","Action"].map(h=><th key={h} scope="col" className={heading}>{h}</th>)}</tr></thead>
       <tbody className="divide-y divide-[#EDF0F5]">
        {pagedPositions.map(p=><tr key={p.id}>
         <td className={cell+" font-mono text-xs"}>{p.id}</td>
         <td className={cell}>{money(p.principal)}</td>
         <td className={cell}>{p.status}{p.pending?" · reduction pending":""}</td>
         <td className={cell}>{p.created}</td>
         <td className={cell}>{p.status==="CLOSED"?<span className="text-xs text-[#64748B]">Closed</span>:<>
          <button type="button" disabled={working||p.status!=="OPEN"||p.pending||BigInt(p.principal)<=0n} onClick={()=>{setSelected(p);setReduceAmount("");setError("");}} className="rounded-lg border border-[#635BFF] px-3 py-2 font-semibold text-[#635BFF] disabled:opacity-40">Reduce</button>
          <button type="button" disabled={working||p.status!=="OPEN"} onClick={()=>void submit("/api/earn/positions/close",{positionId:p.id})} className="ml-2 rounded-lg border px-3 py-2 font-semibold disabled:opacity-40">Close</button>
         </>}</td>
        </tr>)}
        {filteredPositions.length===0&&<tr><td colSpan={5} className="px-5 py-8 text-sm text-[#64748B]">{!strategyId?"Select a market above to view positions.":positionFilter==="OPEN"?"No open positions in this market.":"No positions in this market yet."}</td></tr>}
       </tbody>
      </table>
     </div>
     {pageControls("Market positions",shownPositionsPage,positionPages,setPositionsPage)}
    </>:<>
     <div className="mb-4"><h2 className="text-base font-semibold text-[#11263E]">Trades</h2><p className="mt-1 text-xs text-[#64748B]">Allocation and deallocation activity{strategy?" · "+strategy.name:" for the selected market"}</p></div>
     <div role="region" aria-label="Trades for selected market" tabIndex={0} className="max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-[#E7EDF4]">
      <table className="w-full min-w-[940px] border-collapse text-left">
       <thead className="bg-[#F8FAFC]"><tr>{["Requested","Type","Amount","Status","Position ID","Operation ID","Completed"].map(h=><th key={h} scope="col" className={heading}>{h}</th>)}</tr></thead>
       <tbody className="divide-y divide-[#EDF0F5]">
        {pagedTrades.map(o=><tr key={o.id}><td className={cell}>{o.created}</td><td className={cell}><span className={o.type==="ALLOCATE"?"font-semibold text-emerald-700":"font-semibold text-red-600"}>{o.type==="ALLOCATE"?"Allocate":"Deallocate"}</span></td><td className={cell}>{money(o.amount)}</td><td className={cell}>{o.status}</td><td className={cell+" font-mono text-xs"}>{o.positionId}</td><td className={cell+" font-mono text-xs"}>{o.id}</td><td className={cell}>{o.completed??"—"}</td></tr>)}
        {marketOperations.length===0&&<tr><td colSpan={7} className="px-5 py-8 text-sm text-[#64748B]">{strategyId?"No trades recorded for this market yet.":"Select a market above to view trade history."}</td></tr>}
       </tbody>
      </table>
     </div>
     {pageControls("Market trades",shownTradesPage,tradePages,setTradesPage)}
    </>}
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
