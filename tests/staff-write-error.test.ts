import assert from "node:assert/strict";
import test from "node:test";
import {staffWriteError} from "../src/lib/staff-write-error.ts";
test("stale admin authentication gets a clear 401 reauthentication signal",async()=>{
 const response=staffWriteError(new Error("STAFF_FRESH_LOGIN_REQUIRED"));
 assert.equal(response.status,401);
 assert.equal(response.headers.get("Cache-Control"),"no-store");
 assert.equal((await response.json()).code,"STAFF_REAUTH_REQUIRED");
});
test("other admin failures do not expose internal exception details",async()=>{
 const response=staffWriteError(new Error("sensitive database details"));
 assert.equal(response.status,403);
 const body=await response.json();
 assert.equal(JSON.stringify(body).includes("sensitive"),false);
});
