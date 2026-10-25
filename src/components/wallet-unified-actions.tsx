"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {WithdrawalForm} from "@/components/withdrawal-actions";

type Contact={id:string;name:string;handle:string|null;walletAddress:string|null;kind:"SEND"|"WITHDRAW"};
function amountMicros(value:string):bigint|null{
 if(!/^(0|[1-9]\\d*)(\\.\\d{1,6})?$/.test(value))return null;
 const [whole,fraction=""]=value.split(".");
 const v=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,"0"));
 return v>0n?v:null;
}
export function WalletActions({balanceMicros,unallocatedMicros,pendingMicros,contacts,deposit}:{balanceMicros:string;unallocatedMicros:string;pendingMicros:string;contacts:Contact[];deposit:React.ReactNode}){
 const router=useRouter();
 const [tab,setTab]=useState<"Deposit"|"Withdraw"|"Send @">("Deposit");
 const [manual,setManual]=useState(false);
 const [handle,setHandle]=useState("");
 const [selected,setSelected]=useState("");
 const [amount,setAmount]=useState("");
 const [note,setNote]=useState("");
 const [save,setSave]=useState(false);
 const [label,setLabel]=useState("");
 const [review,setReview]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const key=useRef<string|null>(null);
 const inFlight=useRef(false);
 const saved=contacts.filter(x=>x.kind==="SEND"&&x.handle);
 const target=manual?handle:selected;
 const micros=amountMicros(amount);
 const valid=!!micros&&micros<=BigInt(balanceMicros)&&/^@?[a-z0-9]{8}$/i.test(target.trim())&&(!manual||!save||label.trim().length>0);
 const displayTarget="@"+target.trim().replace(/^@/,"");
 const switchTab=(next:typeof tab)=>{setTab(next);setReview(false);setError("");setSuccess("");};
 async function submit(){
  if(!valid||inFlight.current)return;
  inFlight.current=true;setBusy(true);setError("");
  key.current??=crypto.randomUUID();
  try{
   const response=await fetch("/api/wallet/sends",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({handle:target.trim(),amount,idempotencyKey:key.current,saveRecipient:manual&&save,recipientName:label})});
   const data:{error?:string;id?:string}=await response.json();
   if(!response.ok)throw new Error(data.error||"Unable to send USDC");
   key.current=null;setReview(false);setAmount("");setHandle("");setLabel("");setNote("");setSuccess("Transfer completed. The recipient's available balance has been credited.");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Transfer failed");}finally{setBusy(false);inFlight.current=false;}
 }
 const field="w-full rounded-xl border border-[#DCE3EC] bg-white px-3 py-3 text-sm text-[#14253D] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/15";
 return <section className="rounded-2xl border border-[#E3E8EE] bg-white p-4 sm:p-6">
  <h2 className="text-base font-semibold text-[#14253D]">Move USDC</h2>
  <div role="tablist" aria-label="Wallet actions" className="mt-4 grid grid-cols-3 gap-2">{(["Deposit","Withdraw","Send @"] as const).map(x=><button key={x} role="tab" aria-selected={tab===x} type="button" onClick={()=>switchTab(x)} className={"min-h-12 rounded-xl px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[#635BFF] "+(tab===x?"border border-[#C6C1FF] bg-[#EEEAFE] text-[#5149DB]":"border border-[#EDF0F5] bg-[#F8FAFC] text-[#14253D]")}>{x}</button>)}</div>
  <div role="tabpanel" className="mt-5">
   {tab==="Deposit"?deposit:tab==="Withdraw"?<div><p className="text-sm font-semibold text-[#14253D]">Withdraw to Solana</p><WithdrawalForm balanceMicros={balanceMicros} unallocatedMicros={unallocatedMicros} pendingMicros={pendingMicros}/></div>:
    <div className="space-y-4">
     <h3 className="text-sm font-semibold text-[#14253D]">Send to a Zenvest user</h3>
     {!review?<>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Recipient entry mode"><button type="button" onClick={()=>{setManual(false);setError("");setReview(false)}} className={"min-h-10 rounded-lg border text-xs font-semibold "+(!manual?"border-[#635BFF] bg-[#F2F0FF] text-[#5149DB]":"border-[#E3E8EE]")}>Saved recipient</button><button type="button" onClick={()=>{setManual(true);setError("");setReview(false)}} className={"min-h-10 rounded-lg border text-xs font-semibold "+(manual?"border-[#635BFF] bg-[#F2F0FF] text-[#5149DB]":"border-[#E3E8EE]")}>Enter manually</button></div>
      {manual?<div><label htmlFor="send-handle" className="mb-1 block text-xs font-semibold text-[#14253D]">Recipient handle</label><input id="send-handle" className={field} value={handle} onChange={e=>{setHandle(e.target.value);key.current=null}} placeholder="@username"/></div>:<div><label htmlFor="send-saved" className="mb-1 block text-xs font-semibold text-[#14253D]">Recipient</label><select id="send-saved" className={field} value={selected} onChange={e=>{setSelected(e.target.value);key.current=null}}><option value="">Select recipient</option>{saved.map(x=><option key={x.id} value={x.handle!}>{x.name} · @{x.handle}</option>)}</select>{saved.length===0&&<p className="mt-1 text-xs text-[#64748B]">No saved recipients yet. Select Enter manually to send.</p>}</div>}
      {manual&&<div className="space-y-2"><label className="flex items-center gap-2 text-sm text-[#14253D]"><input type="checkbox" checked={save} onChange={e=>setSave(e.target.checked)} className="accent-[#635BFF]"/>Save recipient</label>{save&&<div><label htmlFor="send-contact-name" className="mb-1 block text-xs font-semibold">Recipient name</label><input id="send-contact-name" className={field} value={label} onChange={e=>setLabel(e.target.value)} maxLength={120} placeholder="e.g. James"/></div>}</div>}
      <div><label htmlFor="send-amount" className="mb-1 block text-xs font-semibold text-[#14253D]">Amount (USDC)</label><input id="send-amount" inputMode="decimal" className={field} value={amount} onChange={e=>{setAmount(e.target.value);key.current=null}} placeholder="0.00"/></div>
      <div><label htmlFor="send-note" className="mb-1 block text-xs font-semibold text-[#14253D]">Note (optional)</label><input id="send-note" className={field} value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a note"/></div>
      <div className="space-y-2 rounded-xl bg-[#F8FAFC] p-3 text-xs"><div className="flex justify-between"><span className="text-[#64748B]">Transfer fee</span><strong>0.00 USDC</strong></div><div className="flex justify-between"><span className="text-[#64748B]">Recipient receives</span><strong>{amount||"0.00"} USDC</strong></div></div>
      <button type="button" disabled={!valid||busy} onClick={()=>{setReview(true);setError("");}} className="min-h-12 w-full rounded-xl bg-[#635BFF] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{manual&&save?"Send and save recipient":"Send"}</button>
     </>:<div className="space-y-3"><div className="space-y-2 rounded-xl bg-[#F3F1FF] p-4"><p className="text-xs font-semibold text-[#64748B]">REVIEW TRANSFER</p><p className="text-xl font-semibold">{amount} USDC</p><p className="text-sm">To {displayTarget}</p><p className="text-xs">Fee: 0.00 USDC</p>{manual&&save&&<p className="text-xs">Save as: {label}</p>}</div><button type="button" disabled={busy} onClick={()=>setReview(false)} className="min-h-11 w-full rounded-xl border border-[#E3E8EE] text-sm font-semibold">Back to edit</button><button type="button" disabled={busy} onClick={submit} className="min-h-12 w-full rounded-xl bg-[#635BFF] text-sm font-semibold text-white disabled:opacity-50">{busy?"Sending…":"Confirm send"}</button></div>}
     {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
     {success&&<p role="status" className="text-sm text-emerald-700">{success}</p>}
    </div>}
  </div>
 </section>;
}
