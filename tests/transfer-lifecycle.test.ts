import test from "node:test";
import assert from "node:assert/strict";
import {ACTIVE_TRANSFER_STATUSES,withdrawalWebhookTarget,availableUnallocatedAfterReservations} from "../src/lib/transfer-lifecycle.ts";
test("only pending, submitting, processing reserve funds",()=>{
 assert.deepEqual([...ACTIVE_TRANSFER_STATUSES],["PENDING","SUBMITTING","PROCESSING"]);
 for(const final of ["COMPLETED","FAILED","CANCELLED"]){
  assert.equal(ACTIVE_TRANSFER_STATUSES.some(x=>x===final),false);
 }
 assert.equal(availableUnallocatedAfterReservations(100_000_000n,20_000_000n,30_000_000n),50_000_000n);
 assert.equal(availableUnallocatedAfterReservations(10n,20n,30n),0n);
});
test("Blockradar success, failure, cancellation map to the requested terminal states",()=>{
 assert.equal(withdrawalWebhookTarget("withdraw.success","SUCCESS"),"COMPLETED");
 assert.equal(withdrawalWebhookTarget("withdraw.failed","FAILED"),"FAILED");
 assert.equal(withdrawalWebhookTarget("withdraw.cancelled","CANCELLED"),"CANCELLED");
 for(const [event,status] of [["withdraw.success","PROCESSING"],["withdraw.failed","CANCELLED"],["withdraw.cancelled","FAILED"],["deposit.success","SUCCESS"]]){
  assert.equal(withdrawalWebhookTarget(event,status),null);
 }
});
