"use client";
import {useCallback,useEffect,useState} from "react";
type Key={id:string;label:string;keyPrefix:string;revokedAt:string|null;createdAt:string};
type Bot={id:string;name:string;description:string;strategyId:string;strategy:{status:string}};
export function BotManagerClient(){
 const [bots,setBots]=useState<Bot[]>([]);
 const [keys,setKeys]=useState<Key[]>([]);
 const [name,setName]=useState("");
 const [description,setDescription]=useState("");
 const [message,setMessage]=useState("");
 const [secret,setSecret]=useState("");
 const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  const [botsResponse,keysResponse]=await Promise.all([
   fetch("/api/bot-manager/bots",{cache:"no-store"}),
   fetch("/api/bot-manager/keys",{cache:"no-store"})
  ]);
  if(botsResponse.ok){const data=await botsResponse.json();setBots(data.bots??[])}
  else setMessage("Unable to load bots");
  if(keysResponse.ok){const data=await keysResponse.json();setKeys(data.keys??[])}
  else setMessage("Unable to load API keys");
 },[]);
 useEffect(()=>{void load()},[load]);
 async function createBot(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/bot-manager/bots",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,description})});
   const v=await r.json();
   if(!r.ok)throw Error(v.error??"Unable to create bot");
   setName("");setDescription("");setMessage("Bot created in ONBOARDING. It cannot receive investor allocations.");
   await load();
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to create bot")}finally{setBusy(false)}
 }
 async function createKey(){
  const label=window.prompt("Name this manager API key");
  if(!label)return;
  setBusy(true);setSecret("");
  try{
   const r=await fetch("/api/bot-manager/keys",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({label})});
   const v=await r.json();
   if(!r.ok)throw Error(v.error??"Unable to create key");
   setSecret(v.apiKey);setMessage("This key works across all strategies you own. Copy it now; it will not be displayed again.");
   await load();
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to create key")}finally{setBusy(false)}
 }
 async function revoke(keyId:string){
  if(!window.confirm("Revoke this manager key? It will stop working for ALL your strategies."))return;
  setBusy(true);
  try{
   const r=await fetch("/api/bot-manager/keys/"+keyId,{method:"DELETE"});
   if(!r.ok)throw Error("Failed to revoke key");
   setMessage("Manager API key revoked across all strategies");await load();
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to revoke key")}finally{setBusy(false)}
 }
 return <div className="space-y-6">
  <section className="rounded-2xl border bg-white p-5 space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><h2 className="font-semibold">Manager API keys</h2>
     <p className="mt-1 text-sm text-slate-600">Use one key to manage all your strategies. The request's strategy ID selects the strategy.</p></div>
    <button disabled={busy} onClick={()=>{void createKey()}} className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50">Generate manager key</button>
   </div>
   <ul className="divide-y">{keys.map(key=><li key={key.id} className="flex items-center justify-between gap-3 py-2 text-sm">
    <span>{key.label} · <code>{key.keyPrefix}…</code> · {key.revokedAt?"Revoked":"Active"}</span>
    {!key.revokedAt&&<button disabled={busy} onClick={()=>{void revoke(key.id)}} className="rounded-lg border px-3 py-1 text-red-700">Revoke for all strategies</button>}
   </li>)}</ul>
   {keys.length===0&&<p className="text-sm text-slate-500">No API keys yet.</p>}
  </section>
  {message&&<p role="status" className="rounded-lg border bg-white p-3 text-sm">{message}</p>}
  {secret&&<div className="rounded-xl border border-amber-400 bg-amber-50 p-4 space-y-2">
   <p className="font-semibold">Manager API key — shown once</p><code className="block break-all">{secret}</code>
   <button onClick={()=>{void navigator.clipboard.writeText(secret)}} className="rounded-lg border px-3 py-2">Copy key</button>
   <button onClick={()=>setSecret("")} className="ml-2 rounded-lg border px-3 py-2">Dismiss</button>
  </div>}
  <form onSubmit={createBot} className="rounded-2xl border bg-white p-5 space-y-3">
   <h2 className="font-semibold">Create bot</h2>
   <label className="block text-sm">Bot name<input required minLength={3} maxLength={100} value={name} onChange={e=>setName(e.target.value)} className="mt-1 block w-full rounded-lg border p-3"/></label>
   <label className="block text-sm">Description<textarea maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 block w-full rounded-lg border p-3"/></label>
   <button disabled={busy} className="rounded-lg bg-[#635BFF] px-5 py-2 text-white disabled:opacity-50">Create bot</button>
  </form>
  <section className="space-y-3"><h2 className="text-lg font-semibold">Your bots and strategies</h2>
   {bots.length===0&&<p className="text-sm text-slate-600">No bots created yet.</p>}
   {bots.map(bot=><article key={bot.id} className="rounded-2xl border bg-white p-5 space-y-3">
    <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{bot.name}</h3><p className="text-xs text-slate-500">Strategy {bot.strategyId}</p></div>
     <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{bot.strategy.status}</span></div>
    {bot.description&&<p className="text-sm text-slate-600">{bot.description}</p>}
   </article>)}
  </section>
 </div>;
}
