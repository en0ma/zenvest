"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function WithdrawalForm() {
  const router=useRouter();
  const [amount,setAmount]=useState("");
  const [address,setAddress]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);setMessage("");
    try {
      const response=await fetch("/api/withdrawals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount,address})});
      const result=await response.json();
      if (!response.ok) throw new Error(result.error ?? "Withdrawal request failed");
      setMessage("Withdrawal requested. It is awaiting review and will not be sent until approved.");
      setAmount("");setAddress("");router.refresh();
    } catch(error) {setMessage(error instanceof Error?error.message:"Withdrawal request failed");}
    finally {setSubmitting(false);}
  }
  return <form onSubmit={submit} className="mt-5 space-y-4">
    <label className="block text-sm font-medium">Amount (USDC)
      <input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="1.00" className="mt-2 w-full rounded-xl border border-[#E3E8EE] px-4 py-3" />
    </label>
    <label className="block text-sm font-medium">Destination Solana address
      <input required autoComplete="off" value={address} onChange={e=>setAddress(e.target.value.trim())} placeholder="Solana public address" className="mt-2 w-full rounded-xl border border-[#E3E8EE] px-4 py-3 font-mono text-sm" />
    </label>
    <p className="text-xs text-[#425466]">Withdrawals are reviewed before sending. Only send to an address that can receive Solana USDC. Blockchain transfers cannot be reversed.</p>
    <button type="submit" disabled={submitting} className="rounded-xl bg-[#635BFF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{submitting?"Submitting...":"Request withdrawal"}</button>
    {message && <p role="status" className="text-sm text-[#425466]">{message}</p>}
  </form>;
}

export function ApproveWithdrawal({id}:{id:string}) {
  const router=useRouter();
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState("");
  async function submit() {
    if (!window.confirm("Approve and broadcast this USDC withdrawal? This sends real blockchain funds on the configured network.")) return;
    setPending(true);
    try {
      const res=await fetch("/api/admin/withdrawals/execute",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
      const result=await res.json();
      if (!res.ok) throw new Error(result.error ?? "Approval failed");
      setMessage("Submitted to Blockradar. Awaiting blockchain confirmation.");router.refresh();
    } catch(error) {setMessage(error instanceof Error?error.message:"Approval failed");}
    finally {setPending(false);}
  }
  return <div className="space-y-2">
    <button disabled={pending} onClick={submit} className="rounded-lg bg-[#635BFF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending?"Processing...":"Approve and send"}</button>
    {message && <p role="status" className="text-xs text-[#425466]">{message}</p>}
  </div>;
}

export function CancelWithdrawal({id}:{id:string}) {
  const router=useRouter();
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState("");
  async function cancel() {
    if(!window.confirm("Cancel this unapproved withdrawal and restore the reserved USDC?")) return;
    setPending(true);
    try {
      const response=await fetch("/api/withdrawals/cancel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error??"Cancellation failed");
      setMessage("Withdrawal cancelled. Funds released.");router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Cancellation failed");}
    finally{setPending(false);}
  }
  return <div className="mt-2">
    <button type="button" onClick={cancel} disabled={pending} className="text-sm font-medium text-[#635BFF] underline disabled:opacity-50">{pending?"Cancelling...":"Cancel request"}</button>
    {message&&<p role="status" className="mt-1 text-xs text-[#425466]">{message}</p>}
  </div>;
}
