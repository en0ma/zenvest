export const investor = {
  name: "Demo Investor",
  equity: 72500000,
  allocated: 30000000,
  unallocated: 40000000,
  realizedPnl: 2500000,
  pendingDeposits: 10000000,
  pendingWithdrawals: 5000000,
} as const;
export const activity = [
  { id: "ZV-1042", type: "Trade settlement", amount: 1200000, status: "Completed", date: "Demo · 10:15" },
  { id: "ZV-1041", type: "Withdrawal request", amount: -5000000, status: "Pending", date: "Demo · 09:44" },
  { id: "ZV-1040", type: "Deposit request", amount: 10000000, status: "Pending", date: "Demo · 09:21" },
  { id: "ZV-1039", type: "Allocation adjustment", amount: 30000000, status: "Effective next trade", date: "Demo · 09:00" },
] as const;
