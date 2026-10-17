import { Resend } from "resend";
export async function sendAccountEmail(to: string, subject: string, message: string, link: string) {
 const apiKey = process.env.RESEND_API_KEY;
 const sender = process.env.EMAIL_FROM;
 if (!apiKey || !sender) throw new Error("Transactional email is not configured");
 const url = new URL(link);
 if (url.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("HTTPS required");
 const resend = new Resend(apiKey);
 const { error } = await resend.emails.send({ from: sender, to, subject, text: message + "\n\n" + url.toString() + "\n\nIf you did not request this, ignore this message." });
 if (error) throw new Error("Email delivery failed");
}
