/**
 * Consistent, intentionally allowlisted financial journey events.
 * Never pass provider payloads, wallet addresses, credentials or error messages.
 */
export type JourneyLevel = "info" | "warn" | "error";
export type JourneyDetails = {
  userId?: string;
  requestId?: string;
  depositId?: string;
  withdrawalId?: string;
  providerTransactionId?: string;
  walletStatus?: string;
  errorType?: string;
  durationMs?: number;
  status?: number;
  count?: number;
};

export function logJourney(
  level: JourneyLevel,
  operation: "wallet_activation" | "deposit_reconciliation" | "deposit_webhook" | "withdrawal_processing" | "withdrawal_settlement",
  outcome: string,
  details: JourneyDetails = {},
) {
  const event = { component: "money-journey", level, operation, outcome, ...details };
  // All fields are controlled by internal call sites, never arbitrary input payloads.
  const line = JSON.stringify(event);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
