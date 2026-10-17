import { Resend } from "resend";
import { zenvestSender } from "@/lib/email-branding";

function escapeHtml(value: string) {
 return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

export async function sendAccountEmail(to: string, subject: string, message: string, link: string, displayName?: string) {
 const apiKey = process.env.RESEND_API_KEY;
 const sender = process.env.EMAIL_FROM;
 if (!apiKey || !sender) throw new Error("Transactional email is not configured");
 const url = new URL(link);
 if (url.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("HTTPS required");
 const resend = new Resend(apiKey);
 const name = displayName?.trim() || "there";
 const reset = url.pathname.includes("reset-password");
 const action = reset ? "Reset your password" : "Activate your account";
 const summary = reset ? "We received a request to reset your Zenvest password." : "You're one step away from accessing your Zenvest account.";
 const actionUrl = url.toString();
 const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:32px 16px;background:#faf8f3;font-family:Arial,Helvetica,sans-serif;color:#292725"><div style="max-width:560px;margin:0 auto"><div style="padding:0 0 25px;font-size:30px;font-weight:800;letter-spacing:-1px">zenvest<span style="color:#b77d52">.</span></div><div style="background:#fff;border:1px solid #e9ddce;border-radius:18px;padding:36px 30px"><p style="margin:0 0 16px;color:#91603f;letter-spacing:2px;font-size:11px;font-weight:700">YOUR ZENVEST ACCOUNT</p><h1 style="font-size:29px;line-height:1.2;margin:0 0 22px;color:#292725">${escapeHtml(action)}</h1><p style="font-size:17px;line-height:1.7;margin:0 0 12px">Hi ${escapeHtml(name)},</p><p style="font-size:16px;line-height:1.7;color:#655a50;margin:0 0 28px">${escapeHtml(summary)}</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#292725" style="border-radius:10px"><a href="${escapeHtml(actionUrl)}" target="_blank" rel="noopener noreferrer" style="display:block;padding:16px 25px;border:1px solid #292725;border-radius:10px;background-color:#292725;color:#ffffff!important;font-size:15px;font-weight:bold;text-decoration:none;text-align:center">${escapeHtml(action)} &rarr;</a></td></tr></table><p style="font-size:13px;color:#827365;line-height:1.7;margin:18px 0 0">If the button doesn&#39;t open, use this link:</p><p style="font-size:13px;line-height:1.6;margin:6px 0 0;overflow-wrap:anywhere;word-break:break-all"><a href="${escapeHtml(actionUrl)}" style="color:#91603f;text-decoration:underline">${escapeHtml(actionUrl)}</a></p><p style="font-size:13px;color:#827365;line-height:1.7;margin:28px 0 0">${reset?"This reset link expires in 30 minutes.":"This activation link expires in 24 hours."} If you did not request this, you can ignore this email.</p></div><p style="margin:22px 0;color:#91603f;font-size:12px;line-height:1.7">Zenvest.market &middot; Secure investor account access</p></div></body></html>`;
 const text = `Hi ${name},\n\n${message}\n\n${actionUrl}\n\n${reset?"This link expires in 30 minutes.":"This link expires in 24 hours."}\n\nIf you did not request this, ignore this message.\n\nZenvest.market`;
 const { error } = await resend.emails.send({ from: zenvestSender(sender), to, subject, html, text });
 if (error) throw new Error("Email delivery failed");
}
