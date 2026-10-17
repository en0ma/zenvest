import assert from "node:assert/strict";
import test from "node:test";
import { registerSchema } from "../src/lib/validation.ts";

test("normalizes investor email and name", () => {
 const parsed = registerSchema.parse({ name: "  Ada User  ", email: "  ADA@Example.COM ", password: "A-long-password-123!" });
 assert.equal(parsed.email, "ada@example.com");
 assert.equal(parsed.name, "Ada User");
});
test("rejects short passwords and malformed email", () => {
 assert.equal(registerSchema.safeParse({ name: "Ada", email: "abc", password: "123" }).success,false);
 assert.equal(registerSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "short" }).success,false);
});
test("rejects role escalation and unexpected registration fields", () => {
 assert.equal(registerSchema.safeParse({ name:"Ada",email:"ada@example.com",password:"some-long-secret",role:"ADMIN" }).success,false);
});
