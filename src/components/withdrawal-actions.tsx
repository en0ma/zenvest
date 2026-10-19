"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WITHDRAWAL_FEE_USDC } from "@/lib/withdrawal-fee";

export function WithdrawalForm({balanceMicros,unallocatedMicros,pendingMicros}:{balanceMicros:string;unallocatedMicros:string;pendingMicros:string}) {
  const router=useRouter();
  const [amount,setAmount]=useState("");
  const [address,setAddress]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [message,setMessage]=useState("");
  const requestKey=useRef<string | null>(null);
  const inFlight=useRef(false);
  const validAmount = /^(0|[1-9]\d*)(\.\d{1,6})?$/.test(amount);
  const gross = validAmount ? (()=>{const [w,f=""]=amount.split(".");return BigInt(w)*1000000n+BigInt(f.padEnd(6,"0"));})() : 0n;
  const balance=BigInt(balanceMicros);
  const amountWithinBalance=gross>0n && gross<=balance;
  const displayGross=amountWithinBalance?gross:0n;
  const net = amountWithinBalance && gross>2000000n ? gross - 2000000n : 0n;
  const unallocated=BigInt(unallocatedMicros);
  const pending=BigInt(pendingMicros);
  const previousShortfall=pending>unallocated?pending-unallocated:0n;
  const newPending=pending+gross;
  const newShortfall=newPending>unallocated?newPending-unallocated:0n;
  const estimatedDeallocation=amountWithinBalance?newShortfall-previousShortfall:0n;
  const addressValid=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  const canSubmit=net>0n && gross<=balance && addressValid && !submitting;
  const show=(v:bigint)=>(v/1000000n).toString()+"."+(v%1000000n).toString().padStart(6,"0").slice(0,2);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || inFlight.current) return;
    inFlight.current=true;
    requestKey.current ??= crypto.randomUUID();
    setSubmitting(true);setMessage("");
    try {
      const response=await fetch("/api/withdrawals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount,address,idempotencyKey:requestKey.current})});
      const result=await response.json();
      if (!response.ok) throw new Error(result.error ?? "Withdrawal request failed");
      setMessage("Withdrawal queued. It will process automatically when the master wallet has enough available USDC.");
      requestKey.current=null;
      setAmount("");setAddress("");router.refresh();
    } catch(error) {setMessage(error instanceof Error?error.message:"Withdrawal request failed");}
    finally {inFlight.current=false;setSubmitting(false);}
  }
  return <form onSubmit={submit} className="mt-5 space-y-4">
    <label className="block text-sm font-medium">Withdrawal amount (USDC)
      <input required inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);requestKey.current=null;}} placeholder="1.00" className="mt-2 w-full rounded-xl border border-[#E3E8EE] px-4 py-3" />
    </label>
    <label className="block text-sm font-medium">Recipient Solana wallet address
      <input required autoComplete="off" value={address} onChange={e=>{setAddress(e.target.value.trim());requestKey.current=null;}} placeholder="Solana public address" className="mt-2 w-full rounded-xl border border-[#E3E8EE] px-4 py-3 font-mono text-sm" />
    </label>
    <div className="rounded-xl bg-[#F6F9FC] p-4 text-sm text-[#425466]">
      <p>Available balance: {show(balance)} USDC</p>
      <p className="mt-2">Gross withdrawal: {show(displayGross)} USDC</p>
      <p className="mt-1">Withdrawal fee: {WITHDRAWAL_FEE_USDC} USDC</p>
      <p className="mt-2 font-semibold text-[#0A2540]">Expected payout: {show(net)} USDC</p>
      {gross>0n && gross<=balance && estimatedDeallocation>0n ? <p className="mt-3 rounded-lg border border-[#F0DBB2] bg-[#FFF9EC] p-3 text-sm text-[#754C17]">This withdrawal will trigger a deallocation request for approximately {show(estimatedDeallocation)} USDC of allocated capital. Your payout will wait until those funds are returned to the master wallet.</p> : gross>0n && gross<=balance ? <p className="mt-3 text-sm text-[#425466]">No additional deallocation is expected for this request.</p> : null}
      {gross>balance&&<p className="mt-2 text-red-600">Insufficient available balance (pending withdrawals already reserved).</p>}
      {gross>0n&&net===0n&&<p className="mt-2 text-red-600">Amount must exceed 2 USDC.</p>}
    </div>
    <p className="text-xs text-[#425466]">Withdrawals are queued and processed automatically in request order when the master wallet has enough USDC. Only send to an address that can receive Solana USDC. Blockchain transfers cannot be reversed.</p>
    <button type="submit" disabled={!canSubmit} className="rounded-xl bg-[#635BFF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{submitting?"Submitting...":"Request withdrawal"}</button>
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
