"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Info, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { WITHDRAWAL_FEE_USDC } from "@/lib/withdrawal-fee";

const format = (v: bigint) => (v / 1000000n).toString() + "." + (v % 1000000n).toString().padStart(6, "0").slice(0, 2);

export function WithdrawalForm({balanceMicros,unallocatedMicros,pendingMicros}:{balanceMicros:string;unallocatedMicros:string;pendingMicros:string}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{kind:"success"|"error";text:string}|null>(null);
  const requestKey = useRef<string|null>(null);
  const inFlight = useRef(false);

  const balance = BigInt(balanceMicros);
  const unallocated = BigInt(unallocatedMicros);
  const pending = BigInt(pendingMicros);
  const amountSyntaxValid = /^(0|[1-9]\d*)(\.\d{1,6})?$/.test(amount);
  const gross = amountSyntaxValid ? (() => {
    const [whole, fractional = ""] = amount.split(".");
    const wholeMicros = BigInt(whole) * 1000000n;
    const parsed = wholeMicros + BigInt(fractional.padEnd(6,"0"));
    return parsed <= 9223372036854775807n ? parsed : 0n;
  })() : 0n;
  const exceedsBalance = gross > balance;
  const tooSmall = gross > 0n && gross <= 2000000n;
  const eligibleAmount = gross > 2000000n && gross <= balance;
  const grossPreview = eligibleAmount ? gross : 0n;
  const netPreview = eligibleAmount ? gross - 2000000n : 0n;
  const previousShortfall = pending > unallocated ? pending - unallocated : 0n;
  const newPending = pending + grossPreview;
  const newShortfall = newPending > unallocated ? newPending - unallocated : 0n;
  const deallocation = eligibleAmount ? newShortfall - previousShortfall : 0n;
  const addressValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  const canSubmit = eligibleAmount && addressValid && !submitting;
  const inputClass = "mt-2 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 py-3.5 text-base text-[#11263E] shadow-sm outline-none transition placeholder:text-[#9AA8B9] focus:border-[#635BFF] focus:ring-4 focus:ring-[#635BFF]/10";
  const onEdit = () => { requestKey.current = null; setFeedback(null); };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || inFlight.current) return;
    inFlight.current = true;
    requestKey.current ??= crypto.randomUUID();
    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/withdrawals", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({amount,address,idempotencyKey:requestKey.current})
      });
      const result: {error?:string;id?:string} = await response.json();
      if (!response.ok) throw new Error(result.error ?? "We couldn't create your withdrawal. Please try again.");
      setFeedback({kind:"success",text:"Withdrawal request received. Track its progress in your withdrawal history below."});
      requestKey.current = null;
      setAmount("");
      setAddress("");
      router.refresh();
    } catch (error) {
      setFeedback({kind:"error",text:error instanceof Error?error.message:"We couldn't create your withdrawal. Please try again."});
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return <form onSubmit={submit} className="mt-6 space-y-6">
    <section aria-label="Available withdrawal balance" className="rounded-2xl border border-[#E4E9F1] bg-[#F8FAFD] px-5 py-6 sm:px-6">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="flex items-end justify-center gap-2">
          <span className="text-4xl font-bold leading-none tracking-tight tabular-nums text-[#11263E] sm:text-5xl">{format(balance)}</span>
          <span className="mb-1 text-xl font-semibold leading-none text-[#64748B] sm:text-2xl">USDC</span>
        </div>
        <p className="mt-3 text-sm font-medium text-[#64748B]">Available to withdraw</p>
      </div>
    </section>

    <div className="grid gap-5">
      <div>
        <label htmlFor="withdrawal-amount" className="text-sm font-semibold text-[#11263E]">Amount to withdraw</label>
        <div className="relative">
          <input id="withdrawal-amount" required inputMode="decimal" autoComplete="off" value={amount}
            onChange={e=>{setAmount(e.target.value);onEdit();}} placeholder="0.00"
            aria-invalid={Boolean(amount && (!amountSyntaxValid || exceedsBalance || tooSmall))}
            className={inputClass + " pr-20 font-semibold tabular-nums"}/>
          <span className="pointer-events-none absolute inset-y-0 right-4 mt-2 flex items-center text-sm font-semibold text-[#64748B]">USDC</span>
        </div>
        {amount && !amountSyntaxValid && <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[#97605A]"><AlertCircle size={15}/> Enter a valid amount with up to 6 decimal places.</p>}
        {exceedsBalance && <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[#97605A]"><AlertCircle size={15}/> This amount exceeds your available balance.</p>}
        {tooSmall && <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[#97605A]"><AlertCircle size={15}/> Enter more than {WITHDRAWAL_FEE_USDC} USDC to cover the fee.</p>}
      </div>
      <div>
        <label htmlFor="recipient-address" className="block text-sm font-semibold text-[#11263E]">Recipient Solana wallet address</label>
        <input id="recipient-address" required autoComplete="off" spellCheck={false} value={address}
          onChange={e=>{setAddress(e.target.value.trim());onEdit();}}
          placeholder="Paste the recipient's Solana address" aria-describedby="recipient-help"
          aria-invalid={address.length>0 && !addressValid}
          className={inputClass + " font-mono text-sm"}/>
        <p id="recipient-help" className="mt-2 text-xs text-[#687B91]">Double-check the address. Transfers to an incorrect wallet cannot be reversed.</p>
        {address && !addressValid && <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[#97605A]"><AlertCircle size={15}/> Enter a valid Solana wallet address.</p>}
      </div>
    </div>

    <section aria-label="Withdrawal summary" className="overflow-hidden rounded-2xl border border-[#E1E7EF] bg-white shadow-sm">
      <div className="border-b border-[#E9EDF3] bg-[#F8FAFD] px-5 py-4"><p className="text-sm font-semibold text-[#11263E]">Withdrawal summary</p>
        <p className="mt-0.5 text-xs text-[#687B91]">Review the estimated amount before submitting.</p></div>
      <dl className="space-y-3 px-5 py-5 text-sm">
        <div className="flex items-center justify-between gap-3"><dt className="text-[#687B91]">Gross withdrawal</dt><dd className="font-semibold tabular-nums text-[#11263E]">{format(grossPreview)} USDC</dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="text-[#687B91]">Processing fee</dt><dd className="font-medium tabular-nums text-[#11263E]">{WITHDRAWAL_FEE_USDC} USDC</dd></div>
        <div className="border-t border-dashed border-[#DBE3ED] pt-4">
          <div className="flex items-center justify-between gap-3"><dt className="font-semibold text-[#11263E]">Recipient receives</dt><dd className="text-xl font-bold tabular-nums tracking-tight text-[#11263E]">{format(netPreview)} <span className="text-sm font-semibold">USDC</span></dd></div>
        </div>
      </dl>
    </section>

    {eligibleAmount && deallocation>0n && <div className="flex gap-3 rounded-2xl border border-[#E7D9B6] bg-[#FFFBF0] px-4 py-4 text-[#74531F]" role="status">
      <Info size={19} className="mt-0.5 shrink-0"/><div><p className="text-sm font-semibold">Additional processing required</p>
        <p className="mt-1 text-sm leading-6">Approximately {format(deallocation)} USDC will need to be made available from your allocated balance before this payout can be completed. You can track that request separately.</p></div>
    </div>}

    <div className="flex items-start gap-2.5 text-xs leading-5 text-[#64748B]"><Clock3 size={16} className="mt-0.5 shrink-0"/>
      <div className="space-y-2"><p>Withdrawals are processed automatically when funds are ready. Processing time varies; submitting a request does not mean the payout is immediate.</p>
      <p>Withdrawals may include allocated USDC, which may require additional processing before payout. <Link href="/wallet" className="font-medium underline underline-offset-2 hover:text-[#635BFF]">Return to wallet</Link>.</p></div></div>

    <button type="submit" disabled={!canSubmit}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#635BFF] px-5 py-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 active:scale-[0.99] motion-reduce:transform-none hover:bg-[#544CE4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#635BFF]/30 disabled:cursor-not-allowed disabled:bg-[#BBC3D1] disabled:shadow-none">
      {submitting?<><Loader2 size={18} className="animate-spin"/>Submitting request...</>:<>Request withdrawal <ArrowRight size={18}/></>}
    </button>

    {feedback && <div role={feedback.kind==="error"?"alert":"status"} className={"flex items-start gap-3 rounded-2xl border px-4 py-4 text-sm leading-6 transition-all duration-200 " + (feedback.kind==="success"?"border-[#CCE5D8] bg-[#F4FAF7] text-[#317054]":"border-[#E8D1CE] bg-[#FCF6F5] text-[#925B55]")}>
      {feedback.kind==="success"?<CheckCircle2 className="mt-0.5 shrink-0" size={19}/>:<AlertCircle className="mt-0.5 shrink-0" size={19}/>}
      <p>{feedback.text}</p>
    </div>}
  </form>;
}
