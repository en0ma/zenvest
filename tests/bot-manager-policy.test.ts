import test from "node:test";
import assert from "node:assert/strict";
import {generateBotKey,hashBotKey,canRevokeBotRole,canPromoteStrategy,canAcceptNewTrade} from "../src/lib/bot-manager-policy.ts";
test("bot keys are unique, unguessable-length tokens and hashes only",()=>{
 const a=generateBotKey(),b=generateBotKey();
 assert.match(a.raw,/^zvb_[A-Za-z0-9_-]{43}$/);
 assert.notEqual(a.raw,b.raw);
 assert.notEqual(a.hash,a.raw);
 assert.equal(hashBotKey(a.raw),a.hash);
 assert.equal(a.hash.length,64);
});
test("onboarding needs explicit approval and shutting down forbids new exposure",()=>{
 assert.equal(canPromoteStrategy("ONBOARDING","MONITORING"),true);
 assert.equal(canPromoteStrategy("MONITORING","TRADING"),true);
 assert.equal(canPromoteStrategy("ONBOARDING","TRADING"),false);
 assert.equal(canPromoteStrategy("SHUTTING_DOWN","TRADING"),false);
 assert.equal(canAcceptNewTrade("SHUTTING_DOWN"),false);
 assert.equal(canAcceptNewTrade("TRADING"),true);
 assert.equal(canRevokeBotRole(["SHUTDOWN","SHUTDOWN"]),true);
 assert.equal(canRevokeBotRole(["SHUTDOWN","SHUTTING_DOWN"]),false);
});
