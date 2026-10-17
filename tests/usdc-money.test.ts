import test from "node:test";
import assert from "node:assert/strict";
import {formatUsdc} from "../src/lib/usdc-money.ts";
test("USDC micro formatter preserves value and sign",()=>{
 assert.equal(formatUsdc(1_250_000_000n),"$1,250.00 USDC");
 assert.equal(formatUsdc(1n),"$0.00 USDC");
 assert.equal(formatUsdc(-1_230_000n),"−$1.23 USDC");
 assert.equal(formatUsdc(0n),"$0.00 USDC");
});
