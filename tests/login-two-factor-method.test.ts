import assert from "node:assert/strict";
import test from "node:test";
import {loginDefaultTwoFactorMethod} from "../src/lib/login-two-factor-method.ts";
test("login chooses only the persisted APP default even when email is enabled",()=>{
 assert.equal(loginDefaultTwoFactorMethod({method:"APP",emailEnabled:true,secretEncrypted:"encrypted-totp"}),"APP");
});
test("login chooses only the persisted EMAIL default even with an authenticator secret",()=>{
 assert.equal(loginDefaultTwoFactorMethod({method:"EMAIL",emailEnabled:true,secretEncrypted:"encrypted-totp"}),"EMAIL");
});
test("login fails closed when the chosen default is unavailable or unknown",()=>{
 assert.equal(loginDefaultTwoFactorMethod({method:"APP",emailEnabled:true,secretEncrypted:null}),null);
 assert.equal(loginDefaultTwoFactorMethod({method:"EMAIL",emailEnabled:false,secretEncrypted:"encrypted-totp"}),null);
 assert.equal(loginDefaultTwoFactorMethod({method:"UNKNOWN",emailEnabled:true,secretEncrypted:"encrypted-totp"}),null);
});
