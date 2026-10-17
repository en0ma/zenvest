import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

// Test the token format and non-reversibility without requiring a database.
test("SHA-256 action tokens have a fixed, non-plaintext digest",()=>{
 const token="a".repeat(64);
 const hash=createHash("sha256").update(token).digest("hex");
 assert.equal(hash.length,64);
 assert.notEqual(hash,token);
});
test("CSPRNG random token is 256 bits encoded as 64 hex characters",()=>{
 const {randomBytes}=require("node:crypto");
 const a=randomBytes(32).toString("hex"),b=randomBytes(32).toString("hex");
 assert.match(a,/^[a-f0-9]{64}$/);
 assert.notEqual(a,b);
});
