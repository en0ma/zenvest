import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "@/components/marketing-page";

export const metadata: Metadata = {
  title: "How to Deposit and Withdraw USDC | Zenvest",
  description: "A simple guide to depositing Solana USDC, understanding your balance, and requesting withdrawals on Zenvest.",
};

export default function HowToPage() {
  return <MarketingPage
    eyebrow="Documentation / How to"
    title="How to deposit and withdraw USDC"
    description="A simple walkthrough of adding funds, checking their progress, and requesting a payout from your Zenvest account."
  >
    <section className="rounded-2xl border border-[#e9dfd2] bg-[#faf7f2] p-5">
      <h2>Before you begin</h2>
      <p>Deposits and withdrawals are being prepared for release and may not be available in your account yet. Only follow these steps when the relevant feature is enabled in your dashboard. Do not send funds to an address shared through social media, unsolicited messages, or unofficial support channels.</p>
      <p>For the wallet features described below, use <strong>USDC on Solana</strong>. Sending the wrong asset or using a different network may cause permanent loss of funds.</p>
    </section>

    <nav aria-label="How-to guides" className="flex flex-wrap gap-3 text-sm font-semibold">
      <a href="#deposit" className="rounded-full border border-[#d8e3de] px-4 py-2 text-[#09785a]">How to deposit</a>
      <a href="#withdraw" className="rounded-full border border-[#d8e3de] px-4 py-2 text-[#09785a]">How to withdraw</a>
      <a href="#statuses" className="rounded-full border border-[#d8e3de] px-4 py-2 text-[#09785a]">Track your request</a>
    </nav>

    <section id="deposit" className="scroll-mt-8">
      <h2>How to deposit USDC</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-6">
        <li>Sign in to Zenvest and open <strong>Wallet</strong>.</li>
        <li>Activate your deposit wallet if asked. Once ready, your personal Solana deposit address and QR code will appear.</li>
        <li>Copy the address or scan the QR code using your sending wallet. Check every character of the address before confirming.</li>
        <li>Choose <strong>USDC on the Solana network</strong> in your sending wallet, enter your deposit amount and confirm the transfer.</li>
        <li>Return to your Zenvest Wallet page to follow the deposit's progress.</li>
      </ol>
      <p><strong>What happens next?</strong> Your deposit may initially appear as <strong>Confirming</strong>. At this stage, it has been detected but is not yet available in your balance. When processing finishes, it changes to <strong>Confirmed</strong> and the amount is added to your unallocated USDC.</p>
      <p>Processing times can vary. If your deposit stays in Confirming longer than expected, keep your transaction reference and contact support. Avoid sending another payment solely because the first is still processing.</p>
    </section>

    <section id="withdraw" className="scroll-mt-8">
      <h2>How to withdraw USDC</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-6">
        <li>Sign in and open <strong>Withdrawals</strong> from your account.</li>
        <li>Review your <strong>Allocated</strong>, <strong>Unallocated</strong>, <strong>Pending withdrawals</strong>, and <strong>Available to withdraw</strong> balances.</li>
        <li>Enter the <strong>total amount you want deducted</strong> in USDC, and provide the recipient's <strong>Solana wallet address</strong>.</li>
        <li>Review the displayed <strong>2 USDC withdrawal fee</strong> and the <strong>expected amount the recipient will receive</strong>. The amount you enter must be greater than 2 USDC and within your available balance.</li>
        <li>If a portion of your money is currently allocated, you may see a message that funds need to be made available before your withdrawal can be sent. This can add processing time.</li>
        <li>Verify the recipient address and payout amount, then select <strong>Request withdrawal</strong>.</li>
      </ol>
      <div className="mt-5 rounded-xl border border-[#d8e3de] bg-[#f7faf8] p-5">
        <p className="mt-0 font-semibold">Example: Request 50 USDC</p>
        <p>Amount deducted from your account: <strong>50 USDC</strong></p>
        <p>Withdrawal fee: <strong>2 USDC</strong></p>
        <p>Expected amount sent to the recipient: <strong>48 USDC</strong></p>
      </div>
      <p>Withdrawal requests are handled automatically as funds become ready for payout. A request is <strong>not an instant transfer</strong>, and timing may depend on the availability of funds and completion of any required processing.</p>
      <p>You can make another withdrawal request while an earlier one is pending, provided enough <strong>Available to withdraw</strong> remains. Existing requests are already reflected in that available amount, so they are not counted twice.</p>
    </section>

    <section id="statuses" className="scroll-mt-8">
      <h2>Understand your balances and statuses</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[440px] border-collapse text-left text-sm">
          <thead><tr className="border-b border-[#e4e8e4]"><th className="py-3 pr-4">Balance</th><th className="py-3">What it means</th></tr></thead>
          <tbody>
            <tr className="border-b border-[#e4e8e4]"><td className="py-3 pr-4 font-semibold">Allocated</td><td className="py-3">Funds assigned to investment activity. These may need additional processing before a payout.</td></tr>
            <tr className="border-b border-[#e4e8e4]"><td className="py-3 pr-4 font-semibold">Unallocated</td><td className="py-3">Funds that are not currently allocated.</td></tr>
            <tr className="border-b border-[#e4e8e4]"><td className="py-3 pr-4 font-semibold">Pending withdrawals</td><td className="py-3">Amounts already requested but not yet finally settled.</td></tr>
            <tr><td className="py-3 pr-4 font-semibold">Available to withdraw</td><td className="py-3">Allocated + Unallocated − Pending withdrawals. This is the amount you can request, not a promise of immediate payout.</td></tr>
          </tbody>
        </table>
      </div>
      <p><strong>Withdrawal status:</strong> <strong>Pending</strong> means the request is queued; <strong>Processing</strong> means the payout is being handled; <strong>Success</strong> means the payout was confirmed. <strong>Failed</strong> means it did not complete, and <strong>Review</strong> means its outcome requires additional verification.</p>
      <p><strong>Deallocation requests:</strong> When your withdrawal requires previously allocated funds, you can track a separate deallocation request in your withdrawal history. It displays its amount, progress, and the withdrawal it belongs to. A completed deallocation does not mean your payout has already been sent. If the payout later fails, any successfully returned funds remain in your unallocated balance.</p>
    </section>

    <section>
      <h2>Important reminders</h2>
      <ul className="mt-4 list-disc space-y-2 pl-6">
        <li>Always use a Solana address that can receive USDC, and check it carefully. Blockchain transfers generally cannot be reversed.</li>
        <li>The 2 USDC fee is shown before you submit; it is included in your gross withdrawal amount, not added on top.</li>
        <li>Account availability to request a withdrawal does not guarantee an immediate payout.</li>
        <li>If a transfer appears delayed, review the status in your account before trying again. Keep the transaction reference for support.</li>
      </ul>
      <p>For a broader overview, visit the <Link href="/docs" className="font-semibold underline text-[#09785a]">documentation home</Link> or read the <Link href="/risk" className="font-semibold underline text-[#09785a]">risk disclosure</Link>.</p>
    </section>
  </MarketingPage>;
}
