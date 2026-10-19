"use client";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Clipboard, Loader2, Wallet } from "lucide-react";

export function ActivateDepositWallet() {
  const [state,setState]=useState<"idle"|"loading"|"error">("idle");
  const [message,setMessage]=useState("");
  async function activate(){
    if(state==="loading")return;
    setState("loading");setMessage("");
    try{
      const response=await fetch("/api/wallet/activate",{method:"POST"});
      const data=await response.json() as {error?:string};
      if(!response.ok){setState("error");setMessage(data.error??"Wallet activation is unavailable. Please try again.");return;}
      window.location.reload();
    }catch{setState("error");setMessage("Unable to connect. Please try again.");}
  }
  return <div className="space-y-3">
    <button type="button" disabled={state==="loading"} onClick={activate}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#635BFF] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#544CE4] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#635BFF]/20 disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none">
      {state==="loading"?<><Loader2 size={17} className="animate-spin"/>Activating wallet...</>:<><Wallet size={17}/>Activate deposit wallet</>}
    </button>
    {message&&<div role="alert" className="flex items-start gap-2.5 rounded-xl border border-[#E8D1CE] bg-[#FCF6F5] px-4 py-3 text-sm leading-6 text-[#925B55] transition-colors duration-200">
      <AlertCircle size={18} className="mt-0.5 shrink-0"/><p>{message}</p>
    </div>}
  </div>;
}
export function CopyDepositAddress({address}:{address:string}){
  const [feedback,setFeedback]=useState<"idle"|"copied"|"error">("idle");
  return <div className="space-y-2">
    <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(address);setFeedback("copied");}catch{setFeedback("error");}}}
      className="inline-flex items-center gap-2 rounded-xl border border-[#D6DEEA] bg-white px-4 py-2.5 text-sm font-semibold text-[#334155] shadow-sm transition-all duration-200 hover:border-[#635BFF] hover:text-[#635BFF] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#635BFF]/20 motion-reduce:transform-none">
      {feedback==="copied"?<CheckCircle2 size={16}/>:<Clipboard size={16}/>} {feedback==="copied"?"Address copied":"Copy address"}
    </button>
    {feedback==="copied"&&<p role="status" className="flex items-center gap-1.5 text-xs font-medium text-[#317054]"><CheckCircle2 size={14}/>Ready to paste into your wallet.</p>}
    {feedback==="error"&&<p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-[#925B55]"><AlertCircle size={14}/>Couldn't copy automatically. Please select and copy the address above.</p>}
  </div>;
}
