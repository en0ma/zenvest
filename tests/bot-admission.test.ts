import test from "node:test";
import assert from "node:assert/strict";
import {evaluateSandboxAdmission} from "../src/lib/bot-admission.ts";
const base={createdAt:new Date("2026-01-01"),fills:100,settlements:30,
 realizedPnlMicros:1000000n,drawdownBps:100,minDays:7,minFills:30,maxDrawdownPct:5,now:new Date("2026-02-01")};
test("requires configured admissions and actual sandbox records",()=>{
 assert.deepEqual(evaluateSandboxAdmission(base),[]);
 assert.deepEqual(evaluateSandboxAdmission({...base,minDays:null}),["ADMISSION_POLICY_UNCONFIGURED"]);
 assert.deepEqual(evaluateSandboxAdmission({...base,createdAt:undefined}),["NO_SANDBOX_HISTORY"]);
});
test("blocks poor admission track records without changing live financial data",()=>{
 const failures=evaluateSandboxAdmission({...base,fills:2,settlements:0,realizedPnlMicros:-1n,drawdownBps:2000});
 assert.ok(failures.includes("INSUFFICIENT_SANDBOX_FILLS"));
 assert.ok(failures.includes("NO_SETTLED_SANDBOX_EVENTS"));
 assert.ok(failures.includes("EXCESSIVE_SANDBOX_DRAWDOWN"));
 assert.ok(failures.includes("NO_POSITIVE_REALIZED_SANDBOX_PNL"));
});
