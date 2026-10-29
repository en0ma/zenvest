"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Info, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { WITHDRAWAL_FEE_USDC } from "@/lib/withdrawal-fee";

const format = (v: bigint) => (v / 1000000n).toString() + "." + (v % 1000000n).toString().padStart(6, "0").slice(0, 2);

export function WithdrawalForm({balanceMicros,unallocatedMicros,pendingMicros,savedRecipients=[]}:{balanceMicros:string;unallocatedMicros:string;pendingMicros:string;savedRecipients?:{id:string;name:string;walletAddress:string}[]}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [recipientMode,setRecipientMode]=useState<"saved"|"manual">("manual");
  const [saveRecipient,setSaveRecipient]=useState(false);
  const [recipientName,setRecipientName]=useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addressCheck,setAddressCheck]=useState<{address:string;state:"checking"|"valid"|"error";message?:string}|null>(null);
  const [quote,setQuote]=useState<{networkFeeMicros:string;totalFeeMicros:string;netMicros:string}|null>(null);
  const [quoteError,setQuoteError]=useState<string|null>(null);
  const [quoting,setQuoting]=useState(false);
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
  const netPreview = quote ? BigInt(quote.netMicros) : 0n;
  const feePreview = quote ? BigInt(quote.totalFeeMicros) : 2000000n;
  const addressValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  const addressApproved=addressCheck?.address===address&&addressCheck.state==="valid";
  const canSubmit = eligibleAmount && addressValid && addressApproved && !!quote && !quoting && !submitting && (recipientMode!=="manual"||!saveRecipient||recipientName.trim().length>0);
  const inputClass = "mt-2 w-full rounded-2xl border border-[#DCE3EC] bg-white px-4 py-3.5 text-base text-[#11263E] shadow-sm outline-none transition placeholder:text-[#9AA8B9] focus:border-[#635BFF] focus:ring-4 focus:ring-[#635BFF]/10";
  const onEdit = () => { requestKey.current = null; setFeedback(null); setQuote(null); };

  useEffect(()=>{
    setAddressCheck(null);
    if(!addressValid)return;
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      setAddressCheck({address,state:"checking"});
      try{
        const response=await fetch("/api/withdrawals/validate-address",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({address}),signal:controller.signal
        });
        const body:{valid?:boolean;address?:string;error?:string}=await response.json();
        if(!controller.signal.aborted)setAddressCheck(response.ok&&body.valid===true&&body.address===address
          ?{address,state:"valid"}
          :{address,state:"error",message:body.error??"Address verification unavailable"});
      }catch{
        if(!controller.signal.aborted)setAddressCheck({address,state:"error",message:"Address verification unavailable. Retry by editing the address."});
      }
    },450);
    return()=>{clearTimeout(timer);controller.abort();};
  },[address,addressValid]);

  useEffect(()=>{
    setQuote(null);setQuoteError(null);
    if(!eligibleAmount||!addressValid)return;
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      setQuoting(true);
      try{
        const response=await fetch("/api/withdrawals/estimate-fee",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({amount,address}),signal:controller.signal
        });
        const data=await response.json();
        if(!response.ok)throw new Error(data.error??"Network fee unavailable");
        if(!controller.signal.aborted)setQuote(data);
      }catch(error){
        if(!controller.signal.aborted)setQuoteError(error instanceof Error?error.message:"Network fee unavailable");
      }finally{if(!controller.signal.aborted)setQuoting(false);}
    },400);
    return ()=>{clearTimeout(timer);controller.abort();setQuoting(false);};
  },[amount,address,eligibleAmount,addressValid]);

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
        body:JSON.stringify({amount,address,idempotencyKey:requestKey.current,maxTotalFeeMicros:quote?.totalFeeMicros,saveRecipient:recipientMode==="manual"&&saveRecipient,recipientName:recipientName.trim()})
      });
      const result: {error?:string;id?:string} = await response.json();
      if (!response.ok) throw new Error(result.error ?? "We couldn't create your withdrawal. Please try again.");
      setFeedback({kind:"success",text:"Withdrawal request received. Track its progress in your withdrawal history below."});
      requestKey.current = null;
      setAmount("");
      setAddress("");
      setSaveRecipient(false);
      setRecipientName("");
      router.refresh();
    } catch (error) {
      setFeedback({kind:"error",text:error instanceof Error?error.message:"We couldn't create your withdrawal. Please try again."});
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return <form onSubmit={submit} className="mt-6 space-y-6">
    <div className="grid gap-5">
      <div>
        <div className="flex items-baseline justify-between gap-3"><label htmlFor="withdrawal-amount" className="text-sm font-semibold text-[#11263E]">Amount</label><span className="whitespace-nowrap text-xs text-[#64748B]">Balance: {format(balance)} USDC</span></div>
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
        <div role="group" aria-label="Recipient entry mode" className="mb-3 grid grid-cols-2 gap-2">
          <button type="button" className={"rounded-xl border px-3 py-2.5 text-xs font-semibold "+(recipientMode==="saved"?"border-[#635BFF] bg-[#F3F1FF]":"border-[#DCE3EC]")} onClick={()=>{setRecipientMode("saved");setAddress("");onEdit()}}>Saved recipient</button>
          <button type="button" className={"rounded-xl border px-3 py-2.5 text-xs font-semibold "+(recipientMode==="manual"?"border-[#635BFF] bg-[#F3F1FF]":"border-[#DCE3EC]")} onClick={()=>{setRecipientMode("manual");setAddress("");onEdit()}}>Enter manually</button>
        </div>
        {recipientMode==="saved"?<div><label className="block text-sm font-semibold" htmlFor="withdraw-saved">Recipient</label><select id="withdraw-saved" className={inputClass} value={address} onChange={e=>{setAddress(e.target.value);onEdit()}}><option value="">Select saved wallet</option>{savedRecipients.map(rec=><option key={rec.id} value={rec.walletAddress}>{rec.name} · {rec.walletAddress.slice(0,7)}…</option>)}</select>{savedRecipients.length===0&&<p className="mt-2 text-xs text-[#64748B]">No saved wallet recipients yet. Choose Enter manually.</p>}</div>:<>
        <label htmlFor="recipient-address" className="block text-sm font-semibold text-[#11263E]">Recipient Solana wallet address</label>
        <input id="recipient-address" required autoComplete="off" spellCheck={false} value={address}
          onChange={e=>{setAddress(e.target.value.trim());onEdit();}}
          placeholder="Paste the recipient's Solana address" aria-describedby="recipient-help"
          aria-invalid={address.length>0 && !addressValid}
          className={inputClass + " font-mono text-sm"}/>
        <p id="recipient-help" className="mt-2 text-xs text-[#687B91]">Double-check the address. Transfers to an incorrect wallet cannot be reversed.</p>
        {address && !addressValid && <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[#97605A]"><AlertCircle size={15}/> Enter a valid Solana wallet address.</p>}
        {addressValid && (!addressCheck || addressCheck.address!==address || addressCheck.state==="checking") && <p role="status" className="mt-2 text-xs text-[#687B91]">Checking address with Blockradar…</p>}
        {addressApproved && <p role="status" className="mt-2 flex items-center gap-1.5 text-xs text-[#317054]"><CheckCircle2 size={15}/> Blockradar validated the Solana address format. This does not establish wallet ownership or AML clearance.</p>}
        {addressValid && addressCheck?.address===address && addressCheck.state==="error" && <p role="alert" className="mt-2 text-xs text-[#97605A]">{addressCheck.message}</p>}
        <label className="mt-4 flex items-center gap-2 text-sm text-[#11263E]"><input type="checkbox" checked={saveRecipient} onChange={e=>setSaveRecipient(e.target.checked)} className="accent-[#635BFF]"/> Save recipient</label>
        {saveRecipient&&<div className="mt-3"><label htmlFor="withdraw-name" className="text-sm font-semibold">Recipient name</label><input id="withdraw-name" className={inputClass} value={recipientName} onChange={e=>setRecipientName(e.target.value)} maxLength={120} placeholder="e.g. Personal wallet"/></div>}
        </>}
      </div>
    </div>

    <section aria-label="Withdrawal summary" className="overflow-hidden rounded-2xl border border-[#E1E7EF] bg-white shadow-sm">
      <div className="border-b border-[#E9EDF3] bg-[#F8FAFD] px-5 py-4"><p className="text-sm font-semibold text-[#11263E]">Withdrawal summary</p>
        <p className="mt-0.5 text-xs text-[#687B91]">Review the estimated amount before submitting.</p></div>
      <dl className="space-y-3 px-5 py-5 text-sm">
        <div className="flex items-center justify-between gap-3"><dt className="text-[#687B91]">Gross withdrawal</dt><dd className="font-semibold tabular-nums text-[#11263E]">{format(grossPreview)} USDC</dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="text-[#687B91]">Zenvest service fee</dt><dd className="font-medium tabular-nums text-[#11263E]">{WITHDRAWAL_FEE_USDC} USDC</dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="text-[#687B91]">Estimated network fee</dt><dd className="font-medium tabular-nums text-[#11263E]">{quote ? format(BigInt(quote.networkFeeMicros))+" USDC" : "—"}</dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="font-medium text-[#687B91]">Total estimated fees</dt><dd className="font-semibold tabular-nums text-[#11263E]">{quote ? format(feePreview)+" USDC" : "—"}</dd></div>
        {quoting && <p role="status" className="text-xs text-[#687B91]">Estimating network fee…</p>}
        {quoteError && <p role="alert" className="text-xs text-[#97605A]">{quoteError}</p>}
        <div className="border-t border-dashed border-[#DBE3ED] pt-4">
          <div className="flex items-center justify-between gap-3"><dt className="font-semibold text-[#11263E]">Recipient receives</dt><dd className="text-xl font-bold tabular-nums tracking-tight text-[#11263E]">{format(netPreview)} <span className="text-sm font-semibold">USDC</span></dd></div>
        </div>
      </dl>
    </section>

    <div className="flex items-start gap-2.5 text-xs leading-5 text-[#64748B]"><Clock3 size={16} className="mt-0.5 shrink-0"/>
      <div className="space-y-2"><p>Withdrawals are processed automatically when funds are ready. Processing time varies; submitting a request does not mean the payout is immediate.</p>
      <p>Withdrawals use your available wallet balance only. To withdraw money that is invested, first request to take it out from your investment on <Link href="/earn" className="font-medium underline underline-offset-2 hover:text-[#635BFF]">Invest</Link>. Once the returned money is available in your wallet, you can withdraw it.</p></div></div>

    <button type="submit" disabled={!canSubmit}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#635BFF] px-5 py-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 active:scale-[0.99] motion-reduce:transform-none hover:bg-[#544CE4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#635BFF]/30 disabled:cursor-not-allowed disabled:bg-[#BBC3D1] disabled:shadow-none">
      {submitting?<><Loader2 size={18} className="animate-spin"/>Submitting request...</>:<>{recipientMode==="manual"&&saveRecipient?"Withdraw and save recipient":"Withdraw"} <ArrowRight size={18}/></>}
    </button>

    {feedback && <div role={feedback.kind==="error"?"alert":"status"} className={"flex items-start gap-3 rounded-2xl border px-4 py-4 text-sm leading-6 transition-all duration-200 " + (feedback.kind==="success"?"border-[#CCE5D8] bg-[#F4FAF7] text-[#317054]":"border-[#E8D1CE] bg-[#FCF6F5] text-[#925B55]")}>
      {feedback.kind==="success"?<CheckCircle2 className="mt-0.5 shrink-0" size={19}/>:<AlertCircle className="mt-0.5 shrink-0" size={19}/>}
      <p>{feedback.text}</p>
    </div>}
  </form>;
}
