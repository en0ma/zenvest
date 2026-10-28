"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ReceiptText, Settings, Wallet, ChartNoAxesCombined } from "lucide-react";

type InvestorNavLinkProps = {
  href: string;
  text: string;
  variant: "mobile" | "sidebar" | "menu";
};

export function InvestorNavLink({ href, text, variant }: InvestorNavLinkProps) {
  const pathname = usePathname();
  const icons = { Overview: LayoutDashboard, "Investor account": Wallet, Wallet, Activity: ReceiptText, Strategy: ChartNoAxesCombined, Settings, Investments: ChartNoAxesCombined };
  const Icon = icons[text as keyof typeof icons] ?? LayoutDashboard;
  const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
  const base = variant === "mobile"
    ? "flex min-w-0 flex-col items-center gap-1 px-1 py-3 text-[10px] font-medium focus-visible:bg-[#EEF2FF]"
    : variant === "sidebar"
      ? "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[#635BFF]"
      : "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold";
  const state = active
    ? variant === "mobile" ? "text-[#625DC1]" : variant === "sidebar" ? "bg-white/15 text-white" : "bg-[#EEF2FF] text-[#243553]"
    : variant === "mobile" ? "text-[#52637B] hover:text-[#625DC1]" : variant === "sidebar" ? "text-[#D1DAEE] hover:bg-white/10 hover:text-white" : "text-[#243553] hover:bg-[#F2F3FB] hover:text-[#625DC1]";
  return <Link href={href} aria-current={active ? "page" : undefined} className={base + " " + state}>
    <Icon size={variant === "mobile" ? 20 : 17} aria-hidden="true" />
    <span className={variant === "mobile" ? "truncate" : ""}>{text}</span>
  </Link>;
}
