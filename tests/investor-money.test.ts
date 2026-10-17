import test from "node:test";
import assert from "node:assert/strict";
import {formatKobo} from "../src/lib/investor-money.ts";
test("kobo formatter preserves exact small-unit precision",()=>{
 assert.equal(formatKobo(1250000n),"₦12,500.00");
 assert.equal(formatKobo(-123n),"−₦1.23");
 assert.equal(formatKobo(1n),"₦0.01");
 assert.equal(formatKobo(0n),"₦0.00");
 assert.equal(formatKobo(999999999999999999n),"₦9,999,999,999,999,999.99");
});
