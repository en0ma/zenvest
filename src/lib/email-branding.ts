/** Consistent transactional email subjects for present and future investor workflows. */
export type ZenvestEmailEvent = "account_activation" | "password_reset" | "deposit_confirmed" | "withdrawal_requested" | "withdrawal_confirmed";
const eventLabels: Record<ZenvestEmailEvent,string> = {
 account_activation:"Account activation",
 password_reset:"Password reset",
 deposit_confirmed:"Deposit confirmed",
 withdrawal_requested:"Withdrawal requested",
 withdrawal_confirmed:"Withdrawal confirmed",
};
export function zenvestEmailSubject(event:ZenvestEmailEvent):string {
 return `Zenvest - ${eventLabels[event]}`;
}
/** Resend expects a formatted mailbox when a sender's display name is specified. */
export function zenvestSender(configured:string):string {
 const match=configured.trim().match(/^(?:[^<>]*<)?([^<>\s@]+@[^<>\s@]+)\s*>?$/);
 if(!match)throw new Error("EMAIL_FROM must contain a valid mailbox");
 return `Zenvest <${match[1]}>`;
}
