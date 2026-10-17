import test from "node:test";import assert from "node:assert/strict";
import {isValidPassword,passwordChecks} from "../src/lib/password-policy.ts";
test("enforces required uppercase, number, symbol and length",()=>{
 assert.equal(isValidPassword("Ab1!x"),true);
 assert.equal(isValidPassword("Ab1!"),false);
 assert.equal(isValidPassword("ab1!x"),false);
 assert.equal(isValidPassword("Abc!x"),false);
 assert.equal(isValidPassword("Ab123"),false);
 assert.equal(isValidPassword("A1!xx"+"x".repeat(68)),false);
 assert.equal(passwordChecks("Ab1!x").every(x=>x.passed),true);
});
