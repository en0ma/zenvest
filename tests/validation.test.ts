import assert from "node:assert/strict";
import test from "node:test";
import { registerSchema } from "../src/lib/validation.ts";

test("normalizes investor email and name", () => {
 const parsed = registerSchema.parse({ name: "AdaUser", email: "  ADA@Example.COM ", password: "Strong1!" });
 assert.equal(parsed.email, "ada@example.com");
 assert.equal(parsed.name, "AdaUser");
});
test("rejects short passwords and malformed email", () => {
 assert.equal(registerSchema.safeParse({ name: "Ada", email: "abc", password: "123" }).success,false);
 assert.equal(registerSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "short" }).success,false);
});
test("validates display names without spaces or symbols, max nine characters", () => {
 for (const name of ["Ada User","Ada_User","Ada!","abcdefghij"," Ada","A"]){assert.equal(registerSchema.safeParse({name,email:"ada@example.com",password:"Strong1!"}).success,false,name)}
 for (const name of ["Warrior","Champ","Maverick","Champ9"]){assert.equal(registerSchema.safeParse({name,email:"ada@example.com",password:"Strong1!"}).success,true,name)}
});
test("rejects passwords longer than 15 characters",()=>{
 assert.equal(registerSchema.safeParse({name:"Warrior",email:"ada@example.com",password:"A1!xx"+"x".repeat(11)}).success,false);
});
test("rejects role escalation and unexpected registration fields", () => {
 assert.equal(registerSchema.safeParse({ name:"Ada",email:"ada@example.com",password:"some-long-secret",role:"ADMIN" }).success,false);
});
