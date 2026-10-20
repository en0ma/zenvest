/**
 * Structured operational event logging.
 * Only pass vetted identifiers and non-sensitive metadata. Never include request
 * bodies, addresses, credentials, arbitrary provider payloads or Error.message.
 */
export type LogSeverity = "info" | "warn" | "error";
export type JourneyOperation = "wallet_activation" | "deposit_webhook" | "deposit_reconciliation" | "withdrawal_payout" | "withdrawal_settlement";
type FieldValue = string | number | boolean | null | undefined;
export type JourneyFields = {
  requestId?: string;
  userId?: string;
  depositId?: string;
  withdrawalId?: string;
  providerTransactionId?: string;
  transactionHash?: string;
  walletStatus?: string;
  providerAddressId?: string;
  status?: number;
  durationMs?: number;
  errorType?: string;
  scanned?: number;
  missing?: number;
  replayRequested?: number;
  complete?: boolean;
};
export function journeyLog(severity: LogSeverity, operation: JourneyOperation, outcome: string, fields: JourneyFields = {}) {
  // Typed allowlist prevents accidental logging of payloads or wallet addresses.
  const cleaned: Record<string, FieldValue> = {};
  for (const key of Object.keys(fields) as (keyof JourneyFields)[]) {
    if (fields[key] !== undefined) cleaned[key] = fields[key];
  }
  const event = { component: "investor-journey", severity, operation, outcome, ...cleaned };
  const serialized = JSON.stringify(event);
  if (severity === "error") console.error(serialized);
  else if (severity === "warn") console.warn(serialized);
  else console.info(serialized);
}
