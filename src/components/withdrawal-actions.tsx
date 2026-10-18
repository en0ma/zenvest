"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { WITHDRAWAL_FEE_USDC } from "@/lib/withdrawal-fee";

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
      setMessage("Withdrawal queued. It will process automatically when the master wallet has enough available USDC.");
      setAmount("");setAddress("");router.refresh();
    } catch(error) {setMessage(error instanceof Error?error.message:"Withdrawal request failed");}
    finally {setSubmitting(false);}
  }
  return <form onSubmit={submit} className="mt-5 space-y-4">
    <label className="block text-sm font-medium">Amount to receive (USDC)
      <input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="1.00" className="mt-2 w-full rounded-xl border border-[#E3E8EE] px-4 py-3" />
    </label>
    <label className="block text-sm font-medium">Destination Solana address
      <input required autoComplete="off" value={address} onChange={e=>setAddress(e.target.value.trim())} placeholder="Solana public address" className="mt-2 w-full rounded-xl border border-[#E3E8EE] px-4 py-3 font-mono text-sm" />
    </label>
    <p className="text-sm text-[#425466]">Withdrawal fee: {WITHDRAWAL_FEE_USDC} USDC. Your available balance is charged the payout amount plus the fee. The fee stays in Zenvest’s master wallet to help cover sweep and payout costs.</p>
    <p className="text-xs text-[#425466]">Withdrawals are queued and processed automatically in request order when the master wallet has enough USDC. Only send to an address that can receive Solana USDC. Blockchain transfers cannot be reversed.</p>
    <button type="submit" disabled={submitting} className="rounded-xl bg-[#635BFF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{submitting?"Submitting...":"Request withdrawal"}</button>
    {message && <p role="status" className="text-sm text-[#425466]">{message}</p>}
  </form>;
}

export function CancelWithdrawal({id}:{id:string}) {
  const router=useRouter();
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState("");
  async function cancel() {
    if(!window.confirm("Cancel this queued withdrawal and restore the reserved USDC?")) return;
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
