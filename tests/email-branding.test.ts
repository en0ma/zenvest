import test from "node:test";
import assert from "node:assert/strict";
import {zenvestEmailSubject,zenvestSender} from "../src/lib/email-branding.ts";
test("uses Zenvest as sender display name without changing verified mailbox",()=>{
 assert.equal(zenvestSender("account@zenvest.market"),"Zenvest <account@zenvest.market>");
 assert.equal(zenvestSender("Account <account@zenvest.market>"),"Zenvest <account@zenvest.market>");
 assert.throws(()=>zenvestSender("not-an-email"));
});
test("standardizes email subjects across event types",()=>{
 assert.equal(zenvestEmailSubject("account_activation"),"Zenvest - Account activation");
 assert.equal(zenvestEmailSubject("password_reset"),"Zenvest - Password reset");
 assert.equal(zenvestEmailSubject("deposit_confirmed"),"Zenvest - Deposit confirmed");
 assert.equal(zenvestEmailSubject("withdrawal_requested"),"Zenvest - Withdrawal requested");
});
