import assert from "node:assert/strict";
import {registerHooks} from "node:module";
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==="resend")return nextResolve(new URL("./ci-resend-shim.mjs",import.meta.url).href,context);
 if(specifier.startsWith("@/lib/"))return nextResolve(new URL("../src/lib/"+specifier.slice(6)+".ts",import.meta.url).href,context);
 if(specifier.startsWith("./")&&context.parentURL?.includes("/src/lib/")&&!/\.[cm]?[jt]s$/.test(specifier))return nextResolve(new URL(specifier+".ts",context.parentURL).href,context);
 return nextResolve(specifier,context);
}});
const {sendAccountEmail}=await import("../src/lib/email.ts");
const {deliveries,setDeliveryError}=await import("./ci-resend-shim.mjs");
const originalKey=process.env.RESEND_API_KEY;
const originalSender=process.env.EMAIL_FROM;
try{
 delete process.env.RESEND_API_KEY;
 delete process.env.EMAIL_FROM;
 await assert.rejects(sendAccountEmail("ci@example.invalid","Subject","Message","https://ci.invalid/verify-email"),/Transactional email is not configured/);
 assert.equal(deliveries.length,0,"no email should be sent without credentials");
 process.env.RESEND_API_KEY="ci-offline-key";
 process.env.EMAIL_FROM="ci@example.invalid";
 const link="https://ci.invalid/verify-email?token=safe";
 await sendAccountEmail("ci-recipient@example.invalid","Account activation","Verify account",link,'<Investor & "Friend">');
 assert.equal(deliveries.length,1);
 const activation=deliveries[0];
 assert.equal(activation.to,"ci-recipient@example.invalid");
 assert.ok(activation.html.includes("&lt;Investor &amp; &quot;Friend&quot;&gt;"));
 assert.ok(!activation.html.includes("<Investor &"));
 assert.ok(activation.text.includes(link));
 assert.ok(activation.html.includes("24 hours"));
 const resetLink="https://ci.invalid/reset-password?token=test";
 await sendAccountEmail("ci-recipient@example.invalid","Reset","Reset account",resetLink);
 const reset=deliveries[1];
 assert.ok(reset.html.includes("Reset your password"));
 assert.ok(reset.html.includes("30 minutes"));
 assert.ok(reset.text.includes("Hi there,"));
 setDeliveryError({message:"Simulated provider rejection"});
 await assert.rejects(sendAccountEmail("ci-recipient@example.invalid","Reset","Message",resetLink),/Email delivery failed/);
 assert.equal(deliveries.length,3);
 console.log("Offline email rendering, HTML escaping, expiration and failure handling passed");
}finally{
 setDeliveryError(null);
 if(originalKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=originalKey;
 if(originalSender===undefined)delete process.env.EMAIL_FROM;else process.env.EMAIL_FROM=originalSender;
}
