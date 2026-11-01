import assert from "node:assert/strict";
import test from "node:test";
import {registerSchema} from "../src/lib/validation.ts";

test("normalizes investor email and retains handle",()=>{
 const parsed=registerSchema.parse({handle:"adauser",email:"  ADA@Example.COM ",password:"Strong1!"});
 assert.equal(parsed.email,"ada@example.com");
 assert.equal(parsed.handle,"adauser");
});
test("rejects short passwords and malformed email",()=>{
 assert.equal(registerSchema.safeParse({handle:"ada",email:"abc",password:"123"}).success,false);
 assert.equal(registerSchema.safeParse({handle:"ada",email:"ada@example.com",password:"short"}).success,false);
});
test("requires 1–8 lowercase alphanumeric characters",()=>{
 for(const handle of ["Ada","ada user","ada_user","ada!","abcdefghi"," ada",""]){
  assert.equal(registerSchema.safeParse({handle,email:"ada@example.com",password:"Strong1!"}).success,false,handle);
 }
 for(const handle of ["a","warrior","champ","maverick","champ9"]){
  assert.equal(registerSchema.safeParse({handle,email:"ada@example.com",password:"Strong1!"}).success,true,handle);
 }
});
test("rejects passwords longer than 15 characters",()=>{
 assert.equal(registerSchema.safeParse({handle:"warrior",email:"ada@example.com",password:"A1!xx"+"x".repeat(11)}).success,false);
});
test("rejects role escalation and unexpected registration fields",()=>{
 assert.equal(registerSchema.safeParse({handle:"ada",email:"ada@example.com",password:"some-long-secret",role:"ADMIN"}).success,false);
});
