"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

type InvestorNavLinkProps = {
  href: string;
  text: string;
  icon: LucideIcon;
  variant: "mobile" | "sidebar" | "menu";
};

export function InvestorNavLink({ href, text, icon: Icon, variant }: InvestorNavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
  const base = variant === "mobile"
    ? "flex min-w-0 flex-col items-center gap-1 px-1 py-3 text-[10px] font-medium focus-visible:bg-[#EEF2FF]"
    : variant === "sidebar"
      ? "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[#635BFF]"
      : "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold";
  const state = active
    ? variant === "mobile" ? "text-[#635BFF]" : "bg-[#EEF2FF] text-[#0A2540]"
    : variant === "mobile" ? "text-[#52637B] hover:text-[#635BFF]" : "text-[#0A2540] hover:bg-[#F6F9FC] hover:text-[#635BFF]";
  return <Link href={href} aria-current={active ? "page" : undefined} className={base + " " + state}>
    <Icon size={variant === "mobile" ? 20 : 17} aria-hidden="true" />
    <span className={variant === "mobile" ? "truncate" : ""}>{text}</span>
  </Link>;
}
