"use client";
import {useCallback,useEffect,useState} from "react";
type Key={id:string;label:string;keyPrefix:string;revokedAt:string|null;createdAt:string};
type Overview={
 strategies:Array<{
  strategy_id:string;strategy_pubkey:string|null;name:string;status:string;venue:string|null;asset:string|null;
  allocated_usdc_micros:string;available_capacity_usdc_micros:string;investor_position_count:number;
  sandbox:{fills:number;settled_events:number;realized_pnl_usdc_micros:string;drawdown_bps:number;estimated_fees_usdc_micros:string};
  live:{settled_participant_records:number;investor_net_realized_pnl_usdc_micros:string;unrealized_pnl_usdc_micros:string|null};
  pending_allocation_usdc_micros:string;pending_deallocation_usdc_micros:string;unresolved_trade_count:number;
  manager_profit_pct:string;platform_profit_pct:string;
  pooled_returns:Array<{status:string;source_verified:boolean;destination_verified:boolean}>;
 }>;
 api_keys:Array<{id:string;api_calls_last_hour:number;rate_limited_last_hour:number;limit_per_minute:number}>;
 manager_revenue:{status:string;statements:unknown[];payout_history:unknown[]};
};
const usdc=(v:string)=>((Number(v)||0)/1000000).toLocaleString("en-US",{maximumFractionDigits:2,minimumFractionDigits:2});
export function BotManagerClient(){
 const [keys,setKeys]=useState<Key[]>([]),[overview,setOverview]=useState<Overview|null>(null);
 const [name,setName]=useState(""),[description,setDescription]=useState("");
 const [asset,setAsset]=useState(""),[min,setMin]=useState("10"),[max,setMax]=useState("5000");
 const [message,setMessage]=useState(""),[secret,setSecret]=useState<{apiKey:string;apiSecret:string}|null>(null);
 const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  const [kr,or]=await Promise.all([
   fetch("/api/bot-manager/keys",{cache:"no-store"}),
   fetch("/api/bot-manager/overview",{cache:"no-store"})
  ]);
  if(kr.ok)setKeys((await kr.json()).keys??[]);
  if(or.ok)setOverview(await or.json());
  if(!kr.ok||!or.ok)setMessage("Some Bot Manager information could not be loaded");
 },[]);
 useEffect(()=>{void load()},[load]);
 async function createBot(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/bot-manager/bots",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name,description,market_type:"event",venue:"kalshi",asset,
      min_allocation:min,max_allocation:max})
   });
   const data=await r.json();
   if(!r.ok)throw Error(data.error??"Unable to create strategy");
   setName("");setDescription("");setAsset("");
   setMessage("Strategy created in ONBOARDING. Sandbox trading is separate from the live TRADING API.");
   await load();
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to create strategy")}finally{setBusy(false)}
 }
 async function createKey(){
  const label=window.prompt("Name this manager API credential");
  if(!label)return;
  setBusy(true);setSecret(null);
  try{
   const r=await fetch("/api/bot-manager/keys",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({label})
   });
   const data=await r.json();
   if(!r.ok)throw Error(data.error??"Unable to issue key");
   setSecret({apiKey:data.apiKey,apiSecret:data.apiSecret});
   setMessage("Copy both credential values now. The API secret is displayed only once.");
   await load();
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to issue key")}finally{setBusy(false)}
 }
 async function revoke(keyId:string){
  if(!window.confirm("Revoke this manager API credential across every strategy?"))return;
  setBusy(true);
  try{
   const r=await fetch("/api/bot-manager/keys/"+keyId,{method:"DELETE"});
   if(!r.ok)throw Error("Could not revoke credential");
   setMessage("Credential revoked across all strategies");await load();
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to revoke")}finally{setBusy(false)}
 }
 return <div className="space-y-6">
  {message&&<p role="status" className="rounded-lg border bg-white p-3 text-sm">{message}</p>}
  <section className="space-y-3 rounded-2xl border bg-white p-5">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><h2 className="font-semibold">Manager API credentials</h2>
     <p className="mt-1 text-sm text-slate-600">One key ID and secret work across all strategies you own. Scoped calls also require the strategy public key.</p></div>
    <button disabled={busy} onClick={()=>void createKey()} className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50">Create credential</button>
   </div>
   {secret&&<div className="space-y-3 rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm">
    <p className="font-semibold">Copy your API secret now — shown only once</p>
    <div><strong>API key ID</strong><code className="block break-all">{secret.apiKey}</code></div>
    <div><strong>API secret</strong><code className="block break-all">{secret.apiSecret}</code></div>
    <button className="rounded border px-3 py-1" onClick={()=>void navigator.clipboard.writeText(
      "X-Zenvest-API-Key: "+secret.apiKey+"\nX-Zenvest-API-Secret: "+secret.apiSecret
    )}>Copy both headers</button>
    <button className="ml-2 rounded border px-3 py-1" onClick={()=>setSecret(null)}>Dismiss</button>
   </div>}
   <ul className="divide-y">{keys.map(k=><li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
    <div><strong>{k.label}</strong> · {k.keyPrefix}… · {k.revokedAt?"Revoked":"Active"}
     <p className="text-xs text-slate-500">Last-hour requests: {overview?.api_keys.find(x=>x.id===k.id)?.api_calls_last_hour??0} · Rate-limited: {overview?.api_keys.find(x=>x.id===k.id)?.rate_limited_last_hour??0} · Per-key limit 60/min</p></div>
    {!k.revokedAt&&<button disabled={busy} className="rounded border px-3 py-2 text-red-700" onClick={()=>void revoke(k.id)}>Revoke</button>}
   </li>)}</ul>
  </section>
  <form onSubmit={createBot} className="space-y-3 rounded-2xl border bg-white p-5">
   <h2 className="font-semibold">Create strategy</h2>
   <p className="text-sm text-slate-600">New strategies begin in ONBOARDING with a virtual Kalshi sandbox. Admin approval is required before any live allocation.</p>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm">Strategy name<input required maxLength={100} minLength={3} value={name} onChange={e=>setName(e.target.value)} className="mt-1 block w-full rounded-lg border p-3"/></label>
    <label className="text-sm">Market type<select value="event" className="mt-1 block w-full rounded-lg border p-3"><option value="event">Event (prediction market)</option></select></label>
    <label className="text-sm">Venue<select value="kalshi" className="mt-1 block w-full rounded-lg border p-3"><option value="kalshi">Kalshi</option></select></label>
    <label className="text-sm">Kalshi series/event tag<input required maxLength={120} value={asset} onChange={e=>setAsset(e.target.value)} placeholder="Exact venue series ticker" className="mt-1 block w-full rounded-lg border p-3"/></label>
    <label className="text-sm">Minimum investor allocation (USDC)<input required value={min} onChange={e=>setMin(e.target.value)} inputMode="decimal" className="mt-1 block w-full rounded-lg border p-3"/></label>
    <label className="text-sm">Maximum investor allocation (USDC)<input required value={max} onChange={e=>setMax(e.target.value)} inputMode="decimal" className="mt-1 block w-full rounded-lg border p-3"/></label>
   </div>
   <label className="block text-sm">Strategy description<textarea maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 block w-full rounded-lg border p-3"/></label>
   <button disabled={busy} className="rounded-lg bg-[#14253D] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Create strategy</button>
  </form>
  <section className="space-y-3">
   <h2 className="text-lg font-semibold">Strategy performance and operations</h2>
   {overview?.strategies.length===0&&<p className="text-sm text-slate-600">No strategies created yet.</p>}
   {overview?.strategies.map(s=><article key={s.strategy_id} className="space-y-4 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-2">
     <div><h3 className="font-semibold">{s.name}</h3>
      <p className="text-xs text-slate-500">{s.venue} · {s.asset}</p>
      <p className="mt-1 text-xs">Strategy pubkey: <code className="break-all">{s.strategy_pubkey??"Not configured"}</code></p></div>
     <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{s.status}</span>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
     <div className="rounded-lg bg-indigo-50 p-3 text-sm"><h4 className="font-semibold">Virtual sandbox only</h4>
      <p>Realized virtual P&L: {usdc(s.sandbox.realized_pnl_usdc_micros)} USDC</p>
      <p>Fills: {s.sandbox.fills} · Resolved events: {s.sandbox.settled_events}</p>
      <p>Drawdown (realized-cost basis): {(s.sandbox.drawdown_bps/100).toFixed(2)}%</p>
      <p>Estimated fees: {usdc(s.sandbox.estimated_fees_usdc_micros)} USDC</p></div>
     <div className="rounded-lg bg-slate-50 p-3 text-sm"><h4 className="font-semibold">Verified live trading</h4>
      <p>Investor net realized P&L: {usdc(s.live.investor_net_realized_pnl_usdc_micros)} USDC</p>
      <p>Settled participant records: {s.live.settled_participant_records}</p>
      <p>Unrealized P&L: unavailable without verified market marks</p></div>
    </div>
    <div className="grid gap-2 text-sm sm:grid-cols-2">
     <p>Investor positions: {s.investor_position_count}</p>
     <p>Allocated: {usdc(s.allocated_usdc_micros)} USDC</p>
     <p>Remaining capacity: {usdc(s.available_capacity_usdc_micros)} USDC</p>
     <p>Pending allocations: {usdc(s.pending_allocation_usdc_micros)} USDC</p>
     <p>Pending deallocations: {usdc(s.pending_deallocation_usdc_micros)} USDC</p>
     <p>Unsettled live trades: {s.unresolved_trade_count}</p>
     <p>Manager profit share: {s.manager_profit_pct}%</p>
     <p>Platform profit share: {s.platform_profit_pct}%</p>
    </div>
    {s.pooled_returns.length>0&&<p className="text-xs text-amber-700">Shutdown returns: {s.pooled_returns.map(x=>x.status+" (source "+(x.source_verified?"verified":"pending")+", destination "+(x.destination_verified?"verified":"pending")+")").join("; ")}</p>}
   </article>)}
  </section>
  <section className="rounded-2xl border bg-white p-5">
   <h2 className="font-semibold">Manager revenue statements</h2>
   <p className="mt-2 text-sm text-slate-600">Strategy profit-sharing percentages are configured and versioned. Verified manager payouts and statements remain disabled until financial settlement and loss treatment are finalized. No earnings are being claimed or credited.</p>
  </section>
 </div>;
}
