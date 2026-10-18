"use client";
import { useState } from "react";

export function ActivateDepositWallet() {
  const [state, setState] = useState<"idle"|"loading"|"error">("idle");
  const [message, setMessage] = useState("");
  async function activate() {
    setState("loading"); setMessage("");
    try {
      const response = await fetch("/api/wallet/activate", { method: "POST" });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setState("error"); setMessage(data.error ?? "Activation unavailable"); return; }
      window.location.reload();
    } catch { setState("error"); setMessage("Connection error. Please try again."); }
  }
  return <div>
    <button type="button" disabled={state === "loading"} onClick={activate} className="rounded-full bg-[#0A2540] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#635BFF] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#635BFF]">
      {state === "loading" ? "Activating…" : "Activate wallet"}
    </button>
    {message && <p role="alert" className="mt-3 text-sm text-[#425466]">{message}</p>}
  </div>;
}

export function CopyDepositAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(address); setCopied(true); } catch { setCopied(false); } }} className="rounded-full border border-[#D6DEEA] px-5 py-2 text-sm font-semibold hover:border-[#635BFF]">
    {copied ? "Copied" : "Copy address"}
  </button>;
}
