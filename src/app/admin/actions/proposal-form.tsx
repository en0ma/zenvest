"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
const operations=[
 {value:"users:write",label:"User change request"},
 {value:"deposits:reconcile",label:"Deposit reconciliation"},
 {value:"withdrawals:approve",label:"Withdrawal approval"},
 {value:"wallets:operate",label:"Wallet operation"}
] as const;
export default function ActionProposalForm({allowed}:{allowed:string[]}){
 const router=useRouter();
 const [selected,setSelected]=useState(allowed[0]??"");
 const [targetId,setTargetId]=useState("");
 const [reason,setReason]=useState("");
 const [amount,setAmount]=useState("");
 const [walletKind,setWalletKind]=useState<"MASTER_TO_WALLET"|"KALSHI_TO_MASTER">("MASTER_TO_WALLET");
 const [destinationAddress,setDestinationAddress]=useState("");
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [busy,setBusy]=useState(false);
 const [reauth,setReauth]=useState(false);
 const choices=operations.filter(o=>allowed.includes(o.value));
 if(!choices.length)return null;
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  setBusy(true);setError("");setSuccess("");setReauth(false);
  const [resource,operation]=selected.split(":");
  try{
   const amountPattern=/^[1-9][0-9]{0,17}$/;
   if(resource==="wallets"&&!amountPattern.test(amount)throw new Error("Enter a positive integer number of USDC micros");
   const payload=resource==="wallets"?(walletKind==="MASTER_TO_WALLET"?{kind:walletKind,amountUsdcMicros:amount,destinationAddress:destinationAddress.trim()}:{kind:walletKind,amountUsdcMicros:amount}):{};
   const response=await fetch("/api/admin/actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({resource,operation,targetId:targetId.trim(),reason:reason.trim(),payload,idempotencyKey:crypto.randomUUID()})});
   const body=await response.json().catch(()=>({}));
   if(!response.ok){if(response.status===401&&body.code==="STAFF_REAUTH_REQUIRED")setReauth(true);throw new Error(typeof body.error==="string"?body.error:"Unable to submit request");}
   setSuccess("Request queued for independent review. No financial operation was executed.");
   setReason("");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Request failed")}finally{setBusy(false)}
 }
 return <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border bg-white p-5">
  <h2 className="text-lg font-semibold">Propose an administrative action</h2>
  <p className="text-sm text-slate-600">This submits a review request only. It cannot transfer funds or modify balances.</p>
  <label className="block text-sm font-medium">Operation<select className="mt-1 w-full rounded border p-2" value={choices.some(c=>c.value===selected)?selected:choices[0].value} onChange={e=>setSelected(e.target.value)}>{choices.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
  <label className="block text-sm font-medium">Exact target ID<input required maxLength={128} className="mt-1 w-full rounded border p-2" value={targetId} onChange={e=>setTargetId(e.target.value)}/></label>
  {selected==="wallets:operate"&&<div className="space-y-3 rounded-lg border p-4">
   <p className="text-sm text-slate-600">All amounts are integer USDC micros. Both operations require independent approval. Kalshi uses the currently mocked investor withdrawal adapter; acceptance means Processing, not settlement.</p>
   <label className="block text-sm font-medium">Wallet transfer<select className="mt-1 w-full rounded border p-2" value={walletKind} onChange={e=>{setWalletKind(e.target.value as "MASTER_TO_WALLET"|"KALSHI_TO_MASTER");setTargetId("");}}><option value="MASTER_TO_WALLET">Master → external Solana wallet (platform funds only)</option><option value="KALSHI_TO_MASTER">Kalshi strategy → master (K_BANK → M_BANK)</option></select></label>
   <p className="text-xs text-slate-600">{walletKind==="MASTER_TO_WALLET"?"Target ID above: DEPOSIT treasury row ID of the configured master wallet. Allowed funds: M_BANK + DEPOSIT_FEE + WITHDRAWAL_FEE only.":"Target ID above: Kalshi strategy ID. Allowed source: K_BANK only. Destination is fixed to the configured master wallet."}</p>
   {walletKind==="MASTER_TO_WALLET"&&<label className="block text-sm font-medium">Destination Solana wallet<input required maxLength={44} className="mt-1 w-full rounded border p-2" value={destinationAddress} onChange={e=>setDestinationAddress(e.target.value)} placeholder="Solana wallet address"/></label>}
   <label className="block text-sm font-medium">Amount in USDC micros<input required inputMode="numeric" pattern="[1-9][0-9]*" className="mt-1 w-full rounded border p-2" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
  </div>}
  <label className="block text-sm font-medium">Reason (12–500 characters)<textarea required minLength={12} maxLength={500} rows={3} className="mt-1 w-full rounded border p-2" value={reason} onChange={e=>setReason(e.target.value)}/></label>
  <button type="submit" disabled={busy} className="rounded bg-[#14253D] px-4 py-2 text-white disabled:opacity-50">{busy?"Submitting…":"Submit for review"}</button>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{reauth&&<Link href="/login" className="text-sm text-violet-700 underline">Sign in again</Link>}
  {success&&<p role="status" className="text-sm text-emerald-800">{success}</p>}
 </form>;
}
