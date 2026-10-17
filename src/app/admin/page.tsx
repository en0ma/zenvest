import { Shell } from "@/components/shell";
import { requireAdmin } from "@/lib/access";
const modules = [
 ["Deposits", "Review NGN deposit requests and bank reconciliation."],
 ["FX conversions", "Record NGN to USDC conversions, rates and fees."],
 ["Trading funding", "Reconcile custodian and Kalshi account balances."],
 ["Allocations", "Queue allocation changes for the next eligible trade snapshot."],
 ["Earnings", "Reconcile settlements and allocate realized trade P&L."],
 ["Withdrawals", "Reserve, review and approve withdrawal requests."],
 ["Audit trail", "Record immutable operational approvals and changes."],
 ["Risk & reports", "Monitor exposure, exceptions and financial reports."],
];
export default async function Admin(){await requireAdmin();return <Shell admin><header><p className="text-muted text-sm">Internal operations · Simulation</p><h1 className="text-3xl font-semibold mt-2">Admin overview</h1><p className="text-muted mt-2">Operations workbench design. No actions can move money or modify investor balances yet.</p></header>
<section className="mt-9 rounded-2xl bg-[#eaf3ed] border border-[#d5e7db] p-6"><strong>Operations are locked in demo mode</strong><p className="text-sm text-[#4b6b59] mt-2">Identity verification, compliance, custody, ledger, bank reconciliation and role-based permissions must be implemented before live operations. This prototype has no KYC screen.</p></section>
<div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5 mt-6">{modules.map(([title,description])=><article key={title} className="bg-white border border-[#e8eeea] shadow-soft rounded-2xl p-7"><h2 className="font-semibold text-lg">{title}</h2><p className="text-sm text-muted leading-6 mt-3">{description}</p><div className="mt-7 text-xs font-semibold text-forest">Planned module →</div></article>)}</div></Shell>;}
